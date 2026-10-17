# Copyright (c) 2026 AJOY. All rights reserved.
"""Ajoy Tools Setup.

Drag this file into the Maya viewport. Enter your access code; once the server accepts it, the
tools are downloaded and installed. This file contains no tools, only the sign-in and installer.
"""
import getpass
import hashlib
import importlib.util
import json
import os
import platform
import re
import shutil
import socket
import ssl
import sys
import tempfile
import traceback
import urllib.error
import urllib.request
import uuid
import zipfile
from pathlib import Path

try:
    from PySide6 import QtCore, QtGui, QtWidgets
    from shiboken6 import wrapInstance
except ImportError:
    try:
        from PySide2 import QtCore, QtGui, QtWidgets
        from shiboken2 import wrapInstance
    except ImportError:  # Maya always ships one of them; this keeps the file importable elsewhere.
        QtCore = QtGui = QtWidgets = wrapInstance = None

PRODUCT = "Ajoy Tools"
COPYRIGHT = "Copyright (c) 2026 AJOY. All rights reserved."

# build.py writes your own Supabase function address on the next line. It is safe to ship: it is
# only an address. The service-role key must never appear in this file.
ACTIVATE_URL = "https://wsadhewcmpdhojgqzstw.supabase.co/functions/v1/activate"

AUTO_CLOSE_MS = 250
RESTART_SECONDS = 5  # the warning countdown before Maya restarts after an install, reinstall or update
REQUEST_TIMEOUT = 25
CHUNK = 64 * 1024


class SetupError(Exception):
    """A problem whose message is safe and useful to show the person installing."""


# --------------------------------------------------------------------------
# Sign-in and download (no Maya or Qt needed)
# --------------------------------------------------------------------------
def is_configured(url=None):
    url = ACTIVATE_URL if url is None else url
    return url.startswith("https://") and "YOUR-PROJECT-REF" not in url


def client_identity():
    """Login name and local network address of this computer (best effort). Lets an admin see who uses a code."""
    try:
        username = getpass.getuser()
    except Exception:
        username = ""
    local_ip = ""
    try:
        probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            probe.settimeout(0.5)
            probe.connect(("8.8.8.8", 80))  # a UDP connect only picks a route: no packet is sent
            local_ip = probe.getsockname()[0]
        finally:
            probe.close()
        if local_ip.startswith("0."):
            local_ip = ""
    except Exception:
        local_ip = ""
    return {"username": username[:128], "local_ip": local_ip[:64]}


def machine_id():
    """Stable anonymous id for this computer, so a code can be limited to a number of machines.
    An earlier install on this computer keeps its saved id, so reinstalling never counts as a new computer."""
    try:
        saved = Path(cmds.internalVar(userAppDir=True)) / "modules" / "AjoyTools" / "access.json"
        data = json.loads(saved.read_text(encoding="utf-8"))
        if data.get("machine_id") and data.get("host") == platform.node():
            return str(data["machine_id"])
    except Exception:
        pass
    raw = "|".join([str(uuid.getnode()), platform.node(), platform.system()])
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _ssl_context():
    return ssl.create_default_context()


def _http_error_message(exc):
    try:
        message = json.loads(exc.read().decode("utf-8")).get("error")
        if message:
            return str(message)
    except Exception:
        pass
    return "The server refused the request ({}).".format(exc.code)


def request_package(code, maya_version="", endpoint=None):
    """Ask the server to check the access code. Returns {'version', 'url', 'sha256'}."""
    body = json.dumps({
        "code": code,
        "python": "cp{}{}".format(*sys.version_info[:2]),  # which build fits this Maya
        "machine_id": machine_id(),
        "machine_name": platform.node(),
        "maya_version": maya_version,
        **client_identity(),
    }).encode("utf-8")
    request = urllib.request.Request(
        endpoint or ACTIVATE_URL, data=body, method="POST",
        headers={"Content-Type": "application/json", "User-Agent": "AjoyToolsSetup/1"})
    try:
        with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT, context=_ssl_context()) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise SetupError(_http_error_message(exc))
    except (urllib.error.URLError, socket.timeout, OSError, ValueError):
        raise SetupError("Could not reach the Ajoy Tools server. Check your internet connection and try again.")
    for key in ("version", "url", "sha256"):
        if not isinstance(data.get(key), str) or not data[key]:
            raise SetupError("The server sent an unexpected answer. Please try again later.")
    return data


def download(url, expected_sha256, destination, progress=None, allow_http=False):
    """Download to `destination` and check its SHA-256. Raises SetupError if anything is off."""
    if not (url.startswith("https://") or (allow_http and url.startswith("http://"))):
        raise SetupError("The download address is not secure, so it was not used.")
    digest = hashlib.sha256()
    done = 0
    try:
        context = _ssl_context() if url.startswith("https://") else None
        with urllib.request.urlopen(url, timeout=REQUEST_TIMEOUT, context=context) as response, \
                open(str(destination), "wb") as stream:
            total = int(response.headers.get("Content-Length") or 0)
            while True:
                chunk = response.read(CHUNK)
                if not chunk:
                    break
                stream.write(chunk)
                digest.update(chunk)
                done += len(chunk)
                if progress:
                    progress(done, total)
    except (urllib.error.URLError, socket.timeout, OSError):
        raise SetupError("The download was interrupted. Check your internet connection and try again.")
    if digest.hexdigest().lower() != expected_sha256.lower():
        try:
            os.remove(str(destination))
        except OSError:
            pass
        raise SetupError("The download failed its integrity check, so nothing was installed. Please try again.")


def extract(zip_path, destination):
    """Unpack the package, refusing any entry that would land outside `destination`."""
    root = Path(destination).resolve()
    root.mkdir(parents=True, exist_ok=True)
    try:
        with zipfile.ZipFile(str(zip_path)) as archive:
            for info in archive.infolist():
                target = (root / info.filename).resolve()
                if target != root and root not in target.parents:
                    raise SetupError("The package is not valid, so nothing was installed.")
            archive.extractall(str(root))
    except zipfile.BadZipFile:
        raise SetupError("The package is damaged, so nothing was installed.")
    package = root / "ajoy_tools"
    if not (package / "install.py").is_file():
        raise SetupError("The package is incomplete, so nothing was installed.")
    return package


ONLINE, OFFLINE = "online", "offline"
WRONG_KIND = {
    ONLINE: "This is a paid access code for the offline install. Choose \"Offline\" above, then click Install again.",
    OFFLINE: "This is a free online code. Choose \"Online\" above, then click Install again.",
}


def fetch_package(code, workdir, maya_version="", progress=None, endpoint=None, allow_http=False, expect=None):
    """Check the code, download and verify the package, unpack it. Returns (version, folder, mode).
    expect: the kind the user chose (online / offline); a code of the other kind is refused before downloading."""
    report = progress or (lambda *_: None)
    report(8, "Checking your access code...")
    info = request_package(code, maya_version, endpoint)
    mode = ONLINE if info.get("mode") == ONLINE else OFFLINE
    if expect and mode != expect:
        raise SetupError(WRONG_KIND[expect])
    report(20, "Downloading Ajoy Tools {}...".format(info["version"]))
    archive = Path(workdir) / "package.zip"

    def on_bytes(done, total):
        if total:
            report(20 + int(40 * done / total), "Downloading Ajoy Tools {}...".format(info["version"]))

    download(info["url"], info["sha256"], archive, on_bytes, allow_http)
    report(62, "Unpacking...")
    return info["version"], extract(archive, Path(workdir) / "payload"), mode


def _version_tuple(text):
    parts = re.findall(r"\d+", str(text or ""))
    return tuple(int(n) for n in parts) if parts else (0,)


def installed_state():
    """What is already installed in Maya's modules folder: (installed version or None, folder path).
    Used to decide whether this is a first install, a reinstall (same version) or an update (newer)."""
    try:
        from maya import cmds
        modules = Path(cmds.internalVar(userAppDir=True)) / "modules"
    except Exception:
        return None, None
    target = modules / "AjoyTools"
    init = target / "scripts" / "ajoy_tools" / "__init__.py"
    if not init.is_file():
        return None, target
    try:
        text = init.read_text(encoding="utf-8")
        version = re.search(r'^VERSION\s*=\s*["\']([^"\']+)["\']', text, re.M).group(1)
    except (OSError, AttributeError):
        version = ""
    return version, target


def load_installer(package_dir):
    """Import the install helpers shipped inside the verified package."""
    spec = importlib.util.spec_from_file_location("ajoy_tools_payload_install", str(Path(package_dir) / "install.py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _forget_loaded_tools(installer):
    """Remove the menu and shelf and unload Ajoy Tools code whose files are gone, without calling into it."""
    try:
        from maya import cmds
        installer._remove_ui_directly(cmds)
    except Exception:
        traceback.print_exc()
    for name in list(sys.modules):
        if name in ("ajoy_tools", "studio_tools") or name.startswith(("ajoy_tools.", "studio_tools.")):
            del sys.modules[name]
    importlib.invalidate_caches()


# --------------------------------------------------------------------------
# Window
# --------------------------------------------------------------------------
# ---- LOOK BEGIN (keep identical in qtui/look.py, AjoyTools_Setup.py and install.py) ----
# The look shared by the setup, install/uninstall and Check for Update windows. Plain styling only:
# no graphics effects and no timers. The one animation is a quick 0.14 second fade when the mouse
# enters or leaves a button; nothing runs while the mouse is still.
_BLUE = "qlineargradient(x1:0, y1:0, x2:0, y2:1, stop:0 #3a8bff, stop:1 #1b64e6)"
_BLUE_HOVER = "qlineargradient(x1:0, y1:0, x2:0, y2:1, stop:0 #52a0ff, stop:1 #2b74f0)"
_BLUE_PRESSED = "qlineargradient(x1:0, y1:0, x2:0, y2:1, stop:0 #1a5fe0, stop:1 #1448b0)"
LOOK_STYLE = """
QDialog#__NAME__ { background: qradialgradient(cx:0.28, cy:0.0, radius:1.15, fx:0.28, fy:0.0, stop:0 #0f2250, stop:0.5 #0b1530, stop:1 #090f1e); }
QLabel { color: #c9d3ee; font-size: 12px; }
QLabel#Title { color: #ffffff; font-size: 28px; font-weight: 800; letter-spacing: 5px; }
QLabel#Subtitle { color: #9db4ee; font-size: 13px; }
QLabel#Version { color: #ffffff; background: __BLUE__; border-radius: 9px; padding: 2px 10px; font-weight: 600; }
QLabel#Section { color: #8d9bbd; font-size: 11px; font-weight: 700; letter-spacing: 2px; }
QLabel#Key { color: #8d9bbd; }
QLabel#Value { color: #eef2ff; }
QLabel#Headline { color: #ffffff; font-size: 15px; font-weight: 700; }
QLabel#Tile { color: #c3cdea; font-size: 11px; }
QLabel#Note { color: #8d9bbd; font-size: 11px; }
QLabel#Copyright { color: #6b7899; font-size: 11px; }
QFrame#Card { background: rgba(255, 255, 255, 10); border: 1px solid #2a3350; border-radius: 14px; }
QFrame#Rule { background: #26304a; max-height: 1px; min-height: 1px; border: none; }
QLineEdit { background: #0a1122; color: #eef2ff; border: 2px solid #2d6fe8; border-radius: 12px; padding: 11px 14px; font-size: 16px; letter-spacing: 1px; selection-background-color: #2f6fe4; }
QLineEdit:focus { border-color: #4a8df5; }
QCheckBox { color: #9db4ee; font-size: 12px; spacing: 10px; }
QCheckBox::indicator { width: 16px; height: 16px; border: 1px solid #3b4668; border-radius: 4px; background: #0a1122; }
QCheckBox::indicator:checked { background: #2f6fe4; border-color: #4a8df5; }
QPushButton { background: #151c2e; color: #eef2ff; border: 1px solid #323c58; border-radius: 10px; padding: 10px 24px; font-size: 13px; }
QPushButton:hover { background: #1c2540; border-color: #43507a; }
QPushButton:pressed { background: #0d1322; border-color: #2b3550; padding-top: 11px; padding-bottom: 9px; }
QPushButton:disabled { color: #626d8c; background: #101626; border-color: #222a40; }
QPushButton#Primary { background: __BLUE__; border: 1px solid #5aa2ff; color: #ffffff; font-weight: 700; }
QPushButton#Primary:hover { background: __BLUE_HOVER__; }
QPushButton#Primary:pressed { background: __BLUE_PRESSED__; border-color: #3d86f0; padding-top: 11px; padding-bottom: 9px; }
QPushButton#Primary:disabled { background: #1d2e55; border-color: #1d2e55; color: #7f8eb3; }
QPushButton#Danger { background: transparent; border-color: #5a3438; color: #f08a90; }
QPushButton#Danger:hover { background: #3a2427; }
QPushButton#Danger:pressed { background: #2a1a1d; border-color: #4a2a2e; padding-top: 11px; padding-bottom: 9px; }
QPushButton#Danger:disabled { color: #6b5254; border-color: #3a2c2e; }
QPushButton#DangerSolid { background: #c24a52; border-color: #d9636b; color: #ffffff; font-weight: 700; }
QPushButton#DangerSolid:hover { background: #d35c64; }
QPushButton#DangerSolid:pressed { background: #a63d44; border-color: #b84f56; padding-top: 11px; padding-bottom: 9px; }
QPushButton#DangerSolid:disabled { background: #4a2a2d; border-color: #4a2a2d; color: #8f6a6d; }
QProgressBar { background: #151c2e; border: none; border-radius: 3px; max-height: 6px; min-height: 6px; }
QProgressBar::chunk { background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #2f6fe4, stop:1 #5aa2ff); border-radius: 3px; }
"""
LOOK_STYLE = (LOOK_STYLE.replace("__BLUE_HOVER__", _BLUE_HOVER).replace("__BLUE_PRESSED__", _BLUE_PRESSED)
              .replace("__BLUE__", _BLUE))

STATIC_GLOW = True  # soft glow around the logo, code field and main button, painted once. False = flat look.
_QPushButton = QtWidgets.QPushButton if QtWidgets else object  # keeps the module importable without Qt


class HoverButton(_QPushButton):
    """A push button that lights up softly while the mouse is over it (a quick fade, only when the mouse
    enters or leaves) and feels pressed when clicked. Nothing runs while the mouse is still."""

    def __init__(self, text="", parent=None):
        super().__init__(text, parent)
        self._hover = 0.0
        self._fade = QtCore.QVariantAnimation(self)
        self._fade.setDuration(140)
        self._fade.valueChanged.connect(self._on_fade)
        self.setCursor(QtCore.Qt.PointingHandCursor)

    def _on_fade(self, value):
        self._hover = float(value)
        self.update()

    def _fade_to(self, target):
        self._fade.stop()
        self._fade.setStartValue(float(self._hover))
        self._fade.setEndValue(float(target))
        self._fade.start()

    def enterEvent(self, event):
        super().enterEvent(event)
        if self.isEnabled():
            self._fade_to(1.0)

    def leaveEvent(self, event):
        super().leaveEvent(event)
        self._fade_to(0.0)

    def hideEvent(self, event):
        super().hideEvent(event)
        self._fade.stop()
        self._hover = 0.0

    def paintEvent(self, event):
        super().paintEvent(event)
        if self._hover <= 0.01 or not self.isEnabled():
            return
        painter = QtGui.QPainter(self)
        try:
            painter.setRenderHint(QtGui.QPainter.Antialiasing, True)
            rect = QtCore.QRectF(self.rect()).adjusted(0.75, 0.75, -0.75, -0.75)
            red = self.objectName() in ("Danger", "DangerSolid")
            rgb = (255, 128, 138) if red else (120, 175, 255)
            if not self.isDown():  # a pressed button shows only its darker pressed colour
                painter.setPen(QtCore.Qt.NoPen)
                painter.setBrush(QtGui.QColor(255, 255, 255, int(30 * self._hover)))
                painter.drawRoundedRect(rect, 10, 10)
            painter.setBrush(QtCore.Qt.NoBrush)
            painter.setPen(QtGui.QPen(QtGui.QColor(rgb[0], rgb[1], rgb[2], int(170 * self._hover)), 1.5))
            painter.drawRoundedRect(rect, 10, 10)
        except Exception:
            import traceback
            traceback.print_exc()
        finally:
            painter.end()


def _draw_glow(painter, window, widget, rgb, radius, strength=1.0):
    """A soft ring of light around a widget. Painted when the window is drawn: no timers, no animation."""
    origin = widget.mapTo(window, QtCore.QPoint(0, 0))
    rect = QtCore.QRectF(origin.x(), origin.y(), widget.width(), widget.height())
    painter.setBrush(QtCore.Qt.NoBrush)
    for i in range(1, 9):
        alpha = int(64 * strength * (1.0 - i / 9.0) ** 2)
        painter.setPen(QtGui.QPen(QtGui.QColor(rgb[0], rgb[1], rgb[2], alpha), 1.6))
        painter.drawRoundedRect(rect.adjusted(-i, -i, i, i), radius + i, radius + i)


def paint_glow(window, targets):
    """Draw the glow rings for every visible (widget, (r, g, b), corner radius, strength) in targets."""
    if not STATIC_GLOW:
        return
    painter = QtGui.QPainter(window)
    try:
        painter.setRenderHint(QtGui.QPainter.Antialiasing, True)
        for widget, rgb, radius, strength in targets:
            if widget is not None and widget.isVisible():
                _draw_glow(painter, window, widget, rgb, radius, strength)
    except Exception:
        import traceback
        traceback.print_exc()
    finally:
        painter.end()
# ---- LOOK END ----

STYLE = LOOK_STYLE.replace("__NAME__", "AjoySignIn") + """
QPushButton#Choice { text-align: left; padding: 12px 14px; border-radius: 12px; background: #0d1528;
                     border: 1px solid #2a3350; color: #c9d3ee; font-size: 12px; }
QPushButton#Choice:hover { border-color: #43507a; background: #111b33; }
QPushButton#Choice:checked { border: 2px solid #3a8bff; background: #12224a; color: #ffffff; }
QPushButton#Choice:disabled { color: #626d8c; }
"""

BANNERS = {
    "ok": ("#17301f", "#2c6b3e", "#8be0a4"),
    "error": ("#331a1c", "#7a3a40", "#f4a1a6"),
    "warn": ("#33290f", "#7a6120", "#f0cf85"),
    "info": ("#13233f", "#2d517e", "#9ec3f5"),
}

_Dialog = QtWidgets.QDialog if QtWidgets else object


def _logo_widget():
    class Logo(QtWidgets.QWidget):
        def __init__(self):
            super().__init__()
            self.setFixedSize(56, 56)

        def paintEvent(self, _event):
            painter = QtGui.QPainter(self)
            painter.setRenderHint(QtGui.QPainter.Antialiasing)
            gradient = QtGui.QLinearGradient(0, 0, 56, 56)
            gradient.setColorAt(0.0, QtGui.QColor("#3b82f6"))
            gradient.setColorAt(1.0, QtGui.QColor("#1e4fb8"))
            painter.setBrush(gradient)
            painter.setPen(QtCore.Qt.NoPen)
            painter.drawRoundedRect(self.rect(), 14, 14)
            painter.setPen(QtGui.QColor("#ffffff"))
            font = QtGui.QFont(self.font())
            font.setPixelSize(24)
            font.setBold(True)
            painter.setFont(font)
            painter.drawText(self.rect(), QtCore.Qt.AlignCenter, "AJ")
            painter.setBrush(QtGui.QColor("#f0883e"))
            painter.setPen(QtCore.Qt.NoPen)
            painter.drawEllipse(QtCore.QPoint(44, 12), 4, 4)

    return Logo()


class SetupDialog(_Dialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.finished_ok = False
        self.result_message = ""
        self._installed_version = None
        self._installer = None
        self._restart_deadline = 0.0
        self._restart_timer = None
        self._restart_bar = None
        self.setObjectName("AjoySignIn")
        self.setWindowTitle(PRODUCT + " Setup")
        self.setWindowFlags(self.windowFlags() & ~QtCore.Qt.WindowContextHelpButtonHint)
        self.setStyleSheet(STYLE)
        self.setFixedWidth(500)
        self._build()

    def _build(self):
        root = QtWidgets.QVBoxLayout(self)
        root.setContentsMargins(28, 24, 28, 16)
        root.setSpacing(14)

        head = QtWidgets.QHBoxLayout()
        head.setSpacing(16)
        self._logo = _logo_widget()
        head.addWidget(self._logo)
        titles = QtWidgets.QVBoxLayout()
        titles.setSpacing(2)
        title = QtWidgets.QLabel("AJOY TOOLS")
        title.setObjectName("Title")
        subtitle = QtWidgets.QLabel("Setup for Autodesk Maya 2023 and newer")
        subtitle.setObjectName("Subtitle")
        titles.addWidget(title)
        titles.addWidget(subtitle)
        head.addLayout(titles, 1)
        root.addLayout(head)

        # The two ways to use Ajoy Tools. The code decides which one is allowed; the choice must match it.
        choices = QtWidgets.QHBoxLayout()
        choices.setSpacing(10)
        self.online_choice = HoverButton("Online  -  free code\nNeeds internet each time Maya starts.\n"
                                         "Always the newest version.")
        self.offline_choice = HoverButton("Offline  -  access code\nWorks without internet.\n"
                                          "Update when you choose.")
        self._kind = QtWidgets.QButtonGroup(self)
        self._kind.setExclusive(True)
        for button in (self.online_choice, self.offline_choice):
            button.setObjectName("Choice")
            button.setCheckable(True)
            button.setAutoDefault(False)
            button.setMinimumHeight(74)
            self._kind.addButton(button)
            choices.addWidget(button, 1)
            button.toggled.connect(self._on_kind)
        self.offline_choice.setChecked(True)
        root.addLayout(choices)

        card = QtWidgets.QFrame()
        card.setObjectName("Card")
        box = QtWidgets.QVBoxLayout(card)
        box.setContentsMargins(16, 14, 16, 14)
        box.setSpacing(10)
        headline = QtWidgets.QLabel("Enter your access code")
        headline.setObjectName("Headline")
        self._headline = headline
        box.addWidget(headline)
        self.code_edit = QtWidgets.QLineEdit()
        self.code_edit.setPlaceholderText("NAME-XXXX-XXXX-XXXX-XXXX")
        echo = getattr(QtWidgets.QLineEdit, "Password", None) or QtWidgets.QLineEdit.EchoMode.Password
        self.code_edit.setEchoMode(echo)
        self.code_edit.returnPressed.connect(self._on_install)
        box.addWidget(self.code_edit)
        self.show_code = QtWidgets.QCheckBox("Show code")
        self.show_code.toggled.connect(self._toggle_echo)
        box.addWidget(self.show_code)
        self._card = card
        root.addWidget(card)

        self.banner = QtWidgets.QLabel()
        self.banner.setWordWrap(True)
        self.banner.setVisible(False)
        root.addWidget(self.banner)

        # Shown only after a successful install, while Maya is about to restart.
        self.restart_label = QtWidgets.QLabel("")
        self.restart_label.setObjectName("Headline")
        self.restart_label.setWordWrap(True)
        self.restart_label.setVisible(False)
        root.addWidget(self.restart_label)

        self.step_label = QtWidgets.QLabel("")
        self.step_label.setObjectName("Note")
        self.step_label.setVisible(False)
        self.progress = QtWidgets.QProgressBar()
        self.progress.setRange(0, 100)
        self.progress.setTextVisible(False)
        self.progress.setVisible(False)
        root.addWidget(self.step_label)
        root.addWidget(self.progress)

        note = QtWidgets.QLabel("Your code is checked online, then Ajoy Tools is downloaded and installed. It is saved on this computer so Maya can check it each time it starts. "
                                "Close other Maya sessions first. Maya restarts by itself when the install is done.")
        note.setObjectName("Note")
        note.setWordWrap(True)
        self._note = note
        root.addWidget(note)

        rule = QtWidgets.QFrame()
        rule.setObjectName("Rule")
        root.addWidget(rule)

        buttons = QtWidgets.QHBoxLayout()
        buttons.setSpacing(8)
        self.cancel_button = HoverButton("Cancel")
        self.cancel_button.setAutoDefault(False)
        self.cancel_button.clicked.connect(self.reject)
        self.install_button = HoverButton("Install")
        self.install_button.setObjectName("Primary")
        self.install_button.setAutoDefault(False)
        self.install_button.clicked.connect(self._on_install)
        self.restart_button = HoverButton("Restart Maya now")
        self.restart_button.setObjectName("Primary")
        self.restart_button.setAutoDefault(False)
        self.restart_button.clicked.connect(self._do_restart)
        self.restart_button.setVisible(False)
        buttons.addStretch(1)
        buttons.addWidget(self.cancel_button)
        buttons.addWidget(self.install_button)
        buttons.addWidget(self.restart_button)
        root.addLayout(buttons)

        copyright_label = QtWidgets.QLabel(COPYRIGHT)
        copyright_label.setObjectName("Copyright")
        copyright_label.setAlignment(QtCore.Qt.AlignCenter)
        root.addWidget(copyright_label)

    def showEvent(self, event):
        super().showEvent(event)
        if not getattr(self, "_checked_installed", False):
            self._checked_installed = True
            self._check_installed()
        self.code_edit.setFocus()

    def _check_installed(self):
        """When the window opens, say whether Ajoy Tools is already here, so the next step reads as a
        reinstall or an update rather than a first install. The code saved on this computer is filled in."""
        version, target = installed_state()
        self._installed_version = version or None
        if not version:
            self.install_button.setText("Install")
            return
        code, mode = "", ""
        try:
            saved = json.loads((target / "access.json").read_text(encoding="utf-8"))
            if isinstance(saved, dict):
                code, mode = str(saved.get("code") or ""), str(saved.get("mode") or "")
        except (OSError, ValueError):
            pass
        if mode == "online":
            self.online_choice.setChecked(True)  # before the banner: changing the choice hides the banner
        elif mode == "offline":
            self.offline_choice.setChecked(True)
        self.install_button.setText("Reinstall / Update")
        if code:
            self.code_edit.setText(code)
            self._banner("info", "Ajoy Tools {} is already installed on this computer, and your code is filled "
                                 "in. Click Reinstall / Update: it reinstalls this version, or updates it if a "
                                 "newer one is available.".format(version))
        else:
            self._banner("info", "Ajoy Tools {} is already installed on this computer. Enter your code to "
                                 "reinstall it, or to update it if a newer version is available.".format(version))

    def paintEvent(self, event):
        super().paintEvent(event)
        paint_glow(self, ((self._logo, (47, 111, 228), 14, 0.8),
                          (self.code_edit, (47, 120, 255), 12, 0.5),
                          (self.install_button, (47, 111, 228), 10, 0.7)))

    # ---- helpers ----------------------------------------------------------
    def kind(self):
        return ONLINE if self.online_choice.isChecked() else OFFLINE

    def _on_kind(self, *_):
        online = self.kind() == ONLINE
        if hasattr(self, "_headline"):
            self._headline.setText("Enter your free code" if online else "Enter your access code")
        if hasattr(self, "banner"):  # not built yet while the default choice is set
            self.banner.setVisible(False)
        self.update()

    def _toggle_echo(self, visible):
        mode = QtWidgets.QLineEdit.EchoMode
        self.code_edit.setEchoMode(mode.Normal if visible else mode.Password)

    def _banner(self, kind, text):
        background, border, colour = BANNERS[kind]
        self.banner.setStyleSheet("background:{};border:1px solid {};border-radius:8px;color:{};"
                                  "padding:10px 12px;font-size:12px;".format(background, border, colour))
        self.banner.setText(text)
        self.banner.setVisible(True)
        self.adjustSize()

    def _report(self, percent, text):
        self.progress.setValue(max(0, min(100, int(percent))))
        self.step_label.setText(text)
        QtWidgets.QApplication.processEvents()

    def _busy(self, working):
        for widget in (self.install_button, self.cancel_button, self.code_edit, self.show_code,
                       self.online_choice, self.offline_choice):
            widget.setEnabled(not working)
        self.progress.setVisible(working)
        self.step_label.setVisible(working)
        if working:
            self.banner.setVisible(False)
            self.progress.setValue(0)
        self.adjustSize()
        QtWidgets.QApplication.processEvents()

    def _fail(self, text):
        self._busy(False)
        self._banner("error", text)
        self.code_edit.setFocus()
        self.code_edit.selectAll()

    # ---- action -----------------------------------------------------------
    def _on_install(self):
        if not self.install_button.isEnabled():
            return
        if not is_configured():
            self._banner("error", "This setup file has not been configured with a server address yet. "
                                  "Please contact the person who sent it to you.")
            return
        code = self.code_edit.text().strip()
        if len(code) < 8:
            self._banner("warn", "Enter your access code to continue.")
            return

        self._busy(True)
        workdir = Path(tempfile.mkdtemp(prefix="ajoy_setup_"))
        stopped = False
        disabled = []
        restart = False
        try:
            version, package, mode = fetch_package(code, workdir, _maya_version(), self._report, expect=self.kind())
            installer = load_installer(package)
            self._installer = installer
            modules = installer.maya_modules_dir()
            installer._validate_source(package)
            installer._check_destination(modules / "AjoyTools", modules / "AjoyTools.mod")
            # Protected tools already running in this Maya stay loaded until Maya closes: the new install is
            # then prepared next to them and switched in when Maya closes.
            in_use = getattr(installer, "compiled_in_use", lambda: False)()
            if not in_use:
                self._report(68, "Closing running tools...")
                try:
                    disabled = installer._stop_runtime(include_legacy=True)
                except OSError:
                    # Tools still loaded from files that were removed earlier (an uninstall in this Maya):
                    # they cannot close themselves, so clear them directly and carry on.
                    traceback.print_exc()
                    _forget_loaded_tools(installer)
                stopped = True
            target = installer.install_files(package, modules, lambda p, t: self._report(70 + int(p * 0.2), t))
            try:
                installer.save_access_code(target, code, machine_id(), mode)
            except TypeError:  # an older installer inside the package
                installer.save_access_code(target, code)
            restart = getattr(installer, "RESTART_NEEDED", False)
            if not restart:
                self._report(92, "Building the menu and shelf...")
                try:
                    installer._activate(target)
                except Exception:
                    traceback.print_exc()
                    raise SetupError("Files were installed, but the menu could not start. Restart Maya and the "
                                     "module will create the menu and shelf. See the Script Editor for details.")
            self._report(100, "Done")
        except SetupError as exc:
            self._fail(str(exc) + ("\n\nRestart Maya before trying again if the Ajoy Tools menu has "
                                   "disappeared." if stopped else ""))
            return
        except Exception as exc:
            traceback.print_exc()
            self._fail("Installation failed: {}{}".format(
                exc, "\n\nRestart Maya before trying again if the Ajoy Tools menu has disappeared." if stopped else ""))
            return
        finally:
            shutil.rmtree(str(workdir), ignore_errors=True)

        self.code_edit.clear()
        old = self._installed_version
        if not old:
            action, message = "installed", "Ajoy Tools {} installed.".format(version)
        elif _version_tuple(version) > _version_tuple(old):
            action, message = "updated", "Ajoy Tools updated from {} to {}.".format(old, version)
        else:
            action, message = "reinstalled", "Ajoy Tools {} reinstalled.".format(version)
        if disabled:
            message += " An earlier startup plug-in was switched off so it cannot clash with this version."
        self.finished_ok = True
        self.result_message = message
        self._busy(False)
        self._offer_restart(action, message)

    # ---- finish: warn, count down, restart Maya ---------------------------
    def _offer_restart(self, action, message):
        """Install done. Maya must restart for a clean, finished state. Warn, give the user 5 seconds to
        save (Maya also asks to save on close), then restart. 'Not now' cancels the automatic restart."""
        for widget in (self._card, self._note, self.online_choice, self.offline_choice,
                       self.install_button, self.progress, self.step_label):
            widget.setVisible(False)
        installer = self._installer
        self._reopen = (installer.can_reopen_maya() if hasattr(installer, "can_reopen_maya")
                        else can_reopen_maya())
        notice = installer.restart_notice() if hasattr(installer, "restart_notice") else (
            "Save your work now.")
        self._banner("ok", message + "\n" + notice)
        self.restart_label.setVisible(True)
        self.restart_button.setText("Restart Maya now" if self._reopen else "Close Maya now")
        self.restart_button.setVisible(True)
        self.cancel_button.setText("Not now")
        self.cancel_button.setEnabled(True)
        # A bar that drains smoothly over the 5 seconds (one animation, nothing else runs).
        self.progress.setRange(0, 1000)
        self.progress.setValue(1000)
        self.progress.setVisible(True)
        self.restart_label.setText("Maya will {} in {} seconds...".format(
            "restart" if self._reopen else "close", RESTART_SECONDS))
        self.adjustSize()
        # Draw the warning now, then start the clock once it is really on screen: the full 5 seconds are
        # always visible, even when Maya was busy just before (it is finishing the install).
        self.repaint()
        QtWidgets.QApplication.processEvents()
        QtCore.QTimer.singleShot(0, self._start_countdown)

    def _start_countdown(self):
        import time
        if not self.isVisible():
            return  # "Not now" or "Restart Maya now" was already clicked
        self._restart_deadline = time.monotonic() + RESTART_SECONDS
        self._restart_bar = QtCore.QPropertyAnimation(self.progress, b"value", self)
        self._restart_bar.setDuration(RESTART_SECONDS * 1000)
        self._restart_bar.setStartValue(1000)
        self._restart_bar.setEndValue(0)
        self._restart_timer = QtCore.QTimer(self)
        self._restart_timer.setInterval(200)  # the clock decides; ticks only refresh the text
        self._restart_timer.timeout.connect(self._restart_tick)
        self._restart_bar.start()
        self._restart_timer.start()

    def _restart_tick(self):
        import math
        import time
        left = self._restart_deadline - time.monotonic()
        if left <= 0:
            self._stop_restart_timer()
            self._do_restart()
            return
        seconds = int(math.ceil(left))
        self.restart_label.setText("Maya will {} in {} second{}...".format(
            "restart" if self._reopen else "close", seconds, "" if seconds == 1 else "s"))

    def _stop_restart_timer(self):
        for item in (self._restart_timer, self._restart_bar):
            if item is not None:
                item.stop()

    def reject(self):
        # "Not now" during the countdown just stops the automatic restart and closes the window.
        self._stop_restart_timer()
        super().reject()

    def _do_restart(self):
        self._stop_restart_timer()
        self.restart_button.setEnabled(False)
        self.cancel_button.setEnabled(False)
        self.restart_label.setText("Saving and restarting Maya..." if self._reopen else
                                   "Saving and closing Maya. Open it again to use Ajoy Tools.")
        QtWidgets.QApplication.processEvents()
        self.accept()
        # Let the window finish closing before Maya quits, so the quit (and its save prompt) run cleanly.
        installer = self._installer
        restart = installer.restart_maya if hasattr(installer, "restart_maya") else _restart_maya
        try:
            import maya.utils as maya_utils
            maya_utils.executeDeferred(restart)
        except Exception:
            restart()


def _relaunch_command():
    """How to start a fresh Maya once this one closes. Returns a list of arguments, or None.
    In Maya, sys.executable is maya.exe (Windows) or the Maya binary (macOS/Linux)."""
    exe = Path(sys.executable)
    if exe.is_file() and "maya" in exe.stem.lower() and "mayapy" not in exe.stem.lower():
        return [str(exe)]
    location = os.environ.get("MAYA_LOCATION", "")
    if location:
        for name in ("maya.exe", "maya", "Maya"):
            candidate = Path(location) / "bin" / name
            if candidate.is_file():
                return [str(candidate)]
    return None


# Runs with Maya's own Python (mayapy) after this Maya is asked to close. It opens Maya again only once
# this Maya has really closed, and after the installer's own after-close step (switching in a protected
# update) has finished. If Maya is not closed within 2 minutes (for example Cancel was pressed in Maya's
# "save changes?" prompt), it does nothing, so a second Maya is never opened. Standard library only.
_REOPEN = r'''
import os, subprocess, sys, time
pid, modules, command = int(sys.argv[1]), sys.argv[2], sys.argv[3:]
def running():
    if os.name == "nt":
        import ctypes
        kernel = ctypes.windll.kernel32
        handle = kernel.OpenProcess(0x00100000, False, pid)  # SYNCHRONIZE
        if not handle:
            return False
        try:
            return kernel.WaitForSingleObject(handle, 0) == 0x102  # WAIT_TIMEOUT: still running
        finally:
            kernel.CloseHandle(handle)
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False
try:
    deadline = time.time() + 120
    while running():
        if time.time() > deadline:
            sys.exit(0)  # Maya stayed open: do not start a second one
        time.sleep(0.5)
    time.sleep(1.5)  # give the installer's after-close step a moment to start
    lock = os.path.join(modules, ".AjoyTools_helper.lock")
    pending = os.path.join(modules, "AjoyTools_pending")
    until = time.time() + 60
    while (os.path.exists(lock) or os.path.isdir(pending)) and time.time() < until:
        time.sleep(0.5)
    options = dict(close_fds=True, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if os.name == "nt":
        flags = 0x00000008 | 0x00000200  # DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP
        try:
            subprocess.Popen(command, creationflags=flags | 0x01000000, **options)  # also leave a launcher's job
        except OSError:
            subprocess.Popen(command, creationflags=flags, **options)
    else:
        subprocess.Popen(command, start_new_session=True, **options)
finally:
    try:
        os.remove(os.path.abspath(sys.argv[0]))
    except OSError:
        pass
'''


def _mayapy():
    """Maya's own Python, which keeps running after Maya itself has closed."""
    exe = Path(sys.executable)
    for name in ("mayapy.exe", "mayapy"):
        candidate = exe.with_name(name)
        if candidate.is_file():
            return candidate
    location = os.environ.get("MAYA_LOCATION", "")
    for name in ("mayapy.exe", "mayapy"):
        candidate = Path(location) / "bin" / name if location else None
        if candidate is not None and candidate.is_file():
            return candidate
    return None


def can_reopen_maya():
    return _relaunch_command() is not None and _mayapy() is not None


def _schedule_reopen():
    """Start the small helper that opens Maya again once this Maya has closed. True when started."""
    command, python = _relaunch_command(), _mayapy()
    if not command or python is None:
        return False
    try:
        from maya import cmds
        modules = str(Path(cmds.internalVar(userAppDir=True)) / "modules")
        helper = Path(tempfile.gettempdir()) / "ajoy_tools_reopen_{}.py".format(os.getpid())
        helper.write_text(_REOPEN, encoding="utf-8")
        import subprocess
        args = [str(python), "-I", "-S", str(helper), str(os.getpid()), modules] + command
        options = dict(close_fds=True, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                       stderr=subprocess.DEVNULL)
        if os.name == "nt":
            flags = 0x00000008 | 0x00000200
            try:
                subprocess.Popen(args, creationflags=flags | 0x01000000, **options)
            except OSError:
                subprocess.Popen(args, creationflags=flags, **options)
        else:
            subprocess.Popen(args, start_new_session=True, **options)
        return True
    except Exception:
        traceback.print_exc()
        return False


def _restart_maya():
    """Ask Maya to close (Maya itself asks to save unsaved work), then open it again once it has closed."""
    from maya import cmds
    _schedule_reopen()
    try:
        cmds.quit(force=False)  # not forced: Maya shows its own "save changes?" prompt when needed
    except Exception:
        traceback.print_exc()


# --------------------------------------------------------------------------
# Maya entry points
# --------------------------------------------------------------------------
def _maya_version():
    try:
        from maya import cmds
        return str(cmds.about(version=True))
    except Exception:
        return ""


def _main_window():
    try:
        import maya.OpenMayaUI as omui
        pointer = omui.MQtUtil.mainWindow()
        return wrapInstance(int(pointer), QtWidgets.QWidget) if pointer else None
    except Exception:
        return None


def show_setup():
    from maya import cmds
    if cmds.about(batch=True):
        raise RuntimeError("Run this setup inside the Maya UI.")
    if int(cmds.about(apiVersion=True)) < 20230000:
        cmds.confirmDialog(title=PRODUCT + " Setup", message="Ajoy Tools requires Maya 2023 or newer.", button=["OK"])
        return
    dialog = SetupDialog(_main_window())
    (getattr(dialog, "exec", None) or dialog.exec_)()
    if dialog.finished_ok and dialog.result_message:
        print("# " + PRODUCT + ": " + dialog.result_message)
        try:
            cmds.inViewMessage(amg=dialog.result_message, pos="midCenter", fade=True)
        except Exception:
            pass


def onMayaDroppedPythonFile(*_):
    show_setup()


if __name__ == "__main__":
    onMayaDroppedPythonFile()
