const root = document.documentElement;
const reduceMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

/* =========================================================
   THEME
   ========================================================= */

const themeBtn = document.getElementById("theme");
const savedTheme = localStorage.getItem("ajoy-theme");

if (savedTheme === "light") {
  root.classList.add("light");
}

if (themeBtn) {
  themeBtn.addEventListener("click", () => {
    root.classList.toggle("light");

    localStorage.setItem(
      "ajoy-theme",
      root.classList.contains("light")
        ? "light"
        : "dark"
    );
  });
}

/* =========================================================
   MOBILE NAV
   ========================================================= */

const menuBtn =
  document.getElementById("menuBtn");

const mobileNav =
  document.getElementById("mobileNav");

if (menuBtn && mobileNav) {
  menuBtn.addEventListener("click", () => {
    const open =
      mobileNav.classList.toggle("open");

    menuBtn.setAttribute(
      "aria-expanded",
      String(open)
    );
  });

  mobileNav
    .querySelectorAll("a")
    .forEach((link) => {
      link.addEventListener("click", () => {
        mobileNav.classList.remove("open");

        menuBtn.setAttribute(
          "aria-expanded",
          "false"
        );
      });
    });
}

/* =========================================================
   YEAR
   ========================================================= */

const yearElement =
  document.getElementById("year");

if (yearElement) {
  yearElement.textContent =
    new Date().getFullYear();
}

/* =========================================================
   HERO ENTRANCE
   ========================================================= */

requestAnimationFrame(() => {
  document.body.classList.add("ready");
});

/* =========================================================
   SCROLL PROGRESS
   ========================================================= */

const progressBar =
  document.getElementById("progress");

let scrollTicking = false;

window.addEventListener(
  "scroll",
  () => {
    if (scrollTicking) {
      return;
    }

    scrollTicking = true;

    requestAnimationFrame(() => {
      const documentElement =
        document.documentElement;

      const scrollableHeight =
        documentElement.scrollHeight -
        documentElement.clientHeight;

      const progress =
        scrollableHeight > 0
          ? (
              documentElement.scrollTop /
              scrollableHeight
            ) * 100
          : 0;

      if (progressBar) {
        progressBar.style.width =
          `${progress}%`;
      }

      scrollTicking = false;
    });
  },
  { passive: true }
);

/* =========================================================
   TOOL GRAPH LINE
   ========================================================= */

const toolList =
  document.getElementById("toolList");

if (
  toolList &&
  "IntersectionObserver" in window
) {
  const toolObserver =
    new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            toolList.classList.add("show");

            toolObserver.disconnect();
          }
        });
      },
      {
        threshold: 0.2,
      }
    );

  toolObserver.observe(toolList);
}

/* =========================================================
   FRAME COUNTER
   ========================================================= */

if (!reduceMotion) {
  let frame = 182;

  const frameElement =
    document.getElementById("frameCount");

  if (frameElement) {
    setInterval(() => {
      frame = (frame + 1) % 2400;

      frameElement.textContent =
        String(frame).padStart(4, "0");
    }, 1400);
  }
}

/* =========================================================
   TOOL CARD CURSOR SPOTLIGHT
   ========================================================= */

if (!reduceMotion) {
  document
    .querySelectorAll(".tool-card")
    .forEach((card) => {
      card.addEventListener(
        "mousemove",
        (event) => {
          const rect =
            card.getBoundingClientRect();

          card.style.setProperty(
            "--mx",
            `${event.clientX - rect.left}px`
          );

          card.style.setProperty(
            "--my",
            `${event.clientY - rect.top}px`
          );
        }
      );
    });

  /* =======================================================
     MAGNETIC BUTTONS
     ======================================================= */

  document
    .querySelectorAll(".magnetic")
    .forEach((button) => {
      button.addEventListener(
        "mousemove",
        (event) => {
          const rect =
            button.getBoundingClientRect();

          const x =
            (
              event.clientX -
              rect.left -
              rect.width / 2
            ) * 0.25;

          const y =
            (
              event.clientY -
              rect.top -
              rect.height / 2
            ) * 0.4;

          button.style.transform =
            `translate(${x}px, ${y}px)`;
        }
      );

      button.addEventListener(
        "mouseleave",
        () => {
          button.style.transform = "";
        }
      );
    });
}

/* =========================================================
   INLINE PREVIEW VIDEOS
   ========================================================= */

const previewVideos =
  document.querySelectorAll(
    ".tool-visual video"
  );

if (
  previewVideos.length &&
  "IntersectionObserver" in window
) {
  const videoObserver =
    new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video =
            entry.target;

          if (entry.isIntersecting) {
            video
              .play()
              .catch(() => {});
          } else {
            video.pause();
          }
        });
      },
      {
        threshold: 0.25,
      }
    );

  previewVideos.forEach((video) => {
    videoObserver.observe(video);
  });
}

/* =========================================================
   VIDEO GUIDE MODAL
   ========================================================= */

const videoModal =
  document.getElementById(
    "videoModal"
  );

const modalPlayer =
  document.getElementById(
    "videoModalPlayer"
  );

const modalCaption =
  document.getElementById(
    "videoModalCaption"
  );

function openVideoModal(
  source,
  poster,
  caption
) {
  if (!videoModal || !modalPlayer) {
    return;
  }

  modalPlayer.src = source;

  if (poster) {
    modalPlayer.poster = poster;
  }

  if (modalCaption) {
    modalCaption.innerHTML =
      caption
        ? `<b>▸</b> ${caption}`
        : "";
  }

  videoModal.classList.add("open");

  videoModal.setAttribute(
    "aria-hidden",
    "false"
  );

  document.body.style.overflow =
    "hidden";

  modalPlayer.currentTime = 0;

  modalPlayer
    .play()
    .catch(() => {});
}

function closeVideoModal() {
  if (!videoModal || !modalPlayer) {
    return;
  }

  videoModal.classList.remove(
    "open"
  );

  videoModal.setAttribute(
    "aria-hidden",
    "true"
  );

  document.body.style.overflow = "";

  modalPlayer.pause();

  modalPlayer.removeAttribute(
    "src"
  );

  modalPlayer.load();
}

/* Open video buttons */

document
  .querySelectorAll(
    "[data-video-trigger]"
  )
  .forEach((button) => {
    button.addEventListener(
      "click",
      () => {
        openVideoModal(
          button.dataset.video,
          button.dataset.poster,
          button.dataset.caption
        );
      }
    );
  });

/* Modal backdrop */

if (videoModal) {
  videoModal
    .querySelectorAll(
      "[data-close]"
    )
    .forEach((element) => {
      element.addEventListener(
        "click",
        closeVideoModal
      );
    });
}

/* Modal close button */

const videoModalClose =
  document.getElementById(
    "videoModalClose"
  );

if (videoModalClose) {
  videoModalClose.addEventListener(
    "click",
    closeVideoModal
  );
}

/* Escape key */

document.addEventListener(
  "keydown",
  (event) => {
    if (
      event.key === "Escape" &&
      videoModal &&
      videoModal.classList.contains(
        "open"
      )
    ) {
      closeVideoModal();
    }
  }
);

/* =========================================================
   TOOL FILTER
   ========================================================= */

const filterButtons =
  document.querySelectorAll(
    ".filter-btn"
  );

const toolGroups =
  document.querySelectorAll(
    ".tool-group[data-platform]"
  );

filterButtons.forEach((button) => {
  button.addEventListener(
    "click",
    () => {
      filterButtons.forEach(
        (item) => {
          item.classList.remove(
            "active"
          );

          item.setAttribute(
            "aria-selected",
            "false"
          );
        }
      );

      button.classList.add(
        "active"
      );

      button.setAttribute(
        "aria-selected",
        "true"
      );

      const selectedPlatform =
        button.dataset.filter;

      toolGroups.forEach(
        (group) => {
          const shouldShow =
            selectedPlatform ===
              "all" ||
            group.dataset.platform ===
              selectedPlatform;

          group.classList.toggle(
            "is-hidden",
            !shouldShow
          );
        }
      );
    }
  );
});

/* =========================================================
   SUBSCRIBE
   Google Apps Script JSONP
   Supported email providers only
   ========================================================= */

const SUBSCRIBE_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbzq2ox5khIkCLkfKTYuZrc4zpoPPoE4KYyqvwfM5nkCQ40C0aoYB6A8BGQMZ_nxKmgQTg/exec";


/* =========================================================
   SUPPORTED EMAIL DOMAINS
   ========================================================= */

const SUPPORTED_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",

  "yahoo.com",
  "yahoo.in",
  "yahoo.co.uk",
  "ymail.com",
  "rocketmail.com",

  "outlook.com",
  "outlook.in",
  "hotmail.com",
  "hotmail.co.uk",
  "hotmail.in",
  "live.com",
  "live.in",
  "msn.com",

  "icloud.com",
  "me.com",
  "mac.com",

  "proton.me",
  "protonmail.com",

  "aol.com",

  "gmx.com",
  "gmx.de",

  "mail.com",

  "zoho.com",
  "zohomail.com",

  "rediffmail.com",

  "yandex.com",
  "yandex.ru",

  "mail.ru",

  "qq.com"
]);


/* =========================================================
   FORM ELEMENTS
   ========================================================= */

const subscribeForm =
  document.getElementById(
    "subscribeForm"
  );


if (subscribeForm) {

  const subscribeBtn =
    document.getElementById(
      "subscribeBtn"
    );


  const subscribeEmail =
    document.getElementById(
      "subscribeEmail"
    );


  const subscribeNote =
    document.getElementById(
      "subscribeNote"
    );


  const subscribeError =
    document.getElementById(
      "subscribeError"
    );


  const subscribeSuccess =
    document.getElementById(
      "subscribeSuccess"
    );


  const subscribedEmailEl =
    document.getElementById(
      "subscribedEmail"
    );


  /* =======================================================
     STATE
     ======================================================= */

  let submissionInProgress =
    false;


  let submissionTimer =
    null;


  let activeScript =
    null;


  /* =======================================================
     EMAIL HELPERS
     ======================================================= */

  function normalizeEmail(
    email
  ) {

    email =
      String(
        email || ""
      )
      .trim()
      .toLowerCase();


    const parts =
      email.split("@");


    if (
      parts.length !== 2
    ) {
      return email;
    }


    let local =
      parts[0];


    const domain =
      parts[1];


    if (
      domain === "gmail.com" ||
      domain === "googlemail.com"
    ) {

      local =
        local
          .split("+")[0]
          .replace(/\./g, "");


      return (
        local +
        "@gmail.com"
      );
    }


    return (
      local +
      "@" +
      domain
    );
  }


  function getDomain(
    email
  ) {

    const parts =
      email.split("@");


    if (
      parts.length !== 2
    ) {
      return "";
    }


    return parts[1];
  }


  function isSupportedDomain(
    email
  ) {

    const domain =
      getDomain(
        normalizeEmail(
          email
        )
      );


    return SUPPORTED_EMAIL_DOMAINS.has(
      domain
    );
  }


  /* =======================================================
     PARTICLES
     ======================================================= */

  function burstParticles(
    originElement
  ) {

    if (
      reduceMotion ||
      !originElement
    ) {
      return;
    }


    const rect =
      originElement.getBoundingClientRect();


    const centerX =
      rect.left +
      rect.width / 2;


    const centerY =
      rect.top +
      rect.height / 2;


    const colors = [
      "var(--axis-x)",
      "var(--axis-y)",
      "var(--axis-z)",
      "var(--accent)"
    ];


    for (
      let i = 0;
      i < 14;
      i++
    ) {

      const particle =
        document.createElement(
          "span"
        );


      particle.className =
        "subscribe-particle";


      const angle =
        (
          Math.PI * 2 * i
        ) / 14 +
        Math.random() * 0.4;


      const distance =
        60 +
        Math.random() * 50;


      particle.style.left =
        `${centerX}px`;


      particle.style.top =
        `${centerY}px`;


      particle.style.background =
        colors[
          i % colors.length
        ];


      particle.style.setProperty(
        "--px",
        `${Math.cos(angle) * distance}px`
      );


      particle.style.setProperty(
        "--py",
        `${Math.sin(angle) * distance}px`
      );


      document.body.appendChild(
        particle
      );


      particle.addEventListener(
        "animationend",
        () => {
          particle.remove();
        },
        {
          once: true
        }
      );
    }
  }


  /* =======================================================
     UI HELPERS
     ======================================================= */

  function clearTimer() {

    if (submissionTimer) {

      clearTimeout(
        submissionTimer
      );

      submissionTimer =
        null;
    }
  }


  function removeActiveScript() {

    if (
      activeScript
    ) {

      activeScript.remove();

      activeScript =
        null;
    }
  }


  function clearError() {

    if (subscribeError) {

      subscribeError.hidden =
        true;
    }
  }


  function showError(
    message
  ) {

    if (!subscribeError) {
      return;
    }


    subscribeError.textContent =
      message ||
      "Something went wrong — mind trying again?";


    subscribeError.hidden =
      false;
  }


  function resetButton() {

    if (!subscribeBtn) {
      return;
    }


    subscribeBtn.disabled =
      false;


    subscribeBtn.classList.remove(
      "is-loading",
      "is-done"
    );
  }


  function finishSubmission() {

    submissionInProgress =
      false;


    clearTimer();


    removeActiveScript();
  }


  function restoreForm() {

    subscribeForm.hidden =
      false;


    if (subscribeNote) {

      subscribeNote.hidden =
        false;
    }


    if (subscribeSuccess) {

      subscribeSuccess.hidden =
        true;
    }


    resetButton();
  }


  function showSuccess(
    email
  ) {

    finishSubmission();


    subscribeForm.hidden =
      true;


    if (subscribeNote) {

      subscribeNote.hidden =
        true;
    }


    if (subscribeError) {

      subscribeError.hidden =
        true;
    }


    if (
      subscribedEmailEl
    ) {

      subscribedEmailEl.textContent =
        email
          ? `(${email})`
          : "";
    }


    if (
      subscribeSuccess
    ) {

      subscribeSuccess.hidden =
        false;
    }
  }


  function showFailure(
    message
  ) {

    finishSubmission();


    restoreForm();


    showError(
      message
    );
  }


  /* =======================================================
     JSONP CALLBACK
     ======================================================= */

  window.ajoySubscriptionCallback =
    function (data) {

      /*
       * Ignore late callbacks.
       */

      if (
        !submissionInProgress
      ) {
        return;
      }


      /*
       * Validate response.
       */

      if (
        !data ||
        data.type !==
          "AJOY_SUBSCRIBE_RESULT"
      ) {

        showFailure(
          "Invalid subscription response."
        );

        return;
      }


      /* -----------------------------------------------
         SUCCESS
         ----------------------------------------------- */

      if (
        data.status ===
        "success"
      ) {

        if (
          subscribeBtn
        ) {

          subscribeBtn.classList.remove(
            "is-loading"
          );


          subscribeBtn.classList.add(
            "is-done"
          );
        }


        burstParticles(
          subscribeBtn
        );


        /*
         * Store only after the server confirms.
         */

        if (
          data.email
        ) {

          localStorage.setItem(
            "ajoy-subscribed-email",
            data.email
          );
        }


        /*
         * No artificial delay.
         */

        showSuccess(
          data.email ||
          subscribeEmail?.value.trim() ||
          ""
        );


        return;
      }


      /* -----------------------------------------------
         DUPLICATE
         ----------------------------------------------- */

      if (
        data.status ===
        "duplicate"
      ) {

        showFailure(
          "This email is already subscribed."
        );

        return;
      }


      /* -----------------------------------------------
         UNSUPPORTED PROVIDER
         ----------------------------------------------- */

      if (
        data.status ===
        "unsupported"
      ) {

        showFailure(
          "Please use a supported email address such as Gmail, Yahoo, Outlook, or iCloud."
        );

        return;
      }


      /* -----------------------------------------------
         INVALID
         ----------------------------------------------- */

      if (
        data.status ===
        "invalid"
      ) {

        showFailure(
          "Please enter a valid email address."
        );

        return;
      }


      /* -----------------------------------------------
         SPAM
         ----------------------------------------------- */

      if (
        data.status ===
        "spam"
      ) {

        showFailure(
          "Submission rejected."
        );

        return;
      }


      /* -----------------------------------------------
         GENERIC ERROR
         ----------------------------------------------- */

      showFailure(
        data.message ||
        "Something went wrong — mind trying again?"
      );
    };


  /* =======================================================
     FORM SUBMISSION
     ======================================================= */

  subscribeForm.addEventListener(
    "submit",
    (event) => {

      event.preventDefault();


      /*
       * Prevent double click.
       */

      if (
        submissionInProgress
      ) {
        return;
      }


      const rawEmail =
        subscribeEmail?.value.trim() ||
        "";


      clearError();


      /* -----------------------------------------------
         EMPTY
         ----------------------------------------------- */

      if (
        !rawEmail
      ) {

        subscribeEmail?.focus();

        return;
      }


      /* -----------------------------------------------
         HTML EMAIL VALIDATION
         ----------------------------------------------- */

      if (
        subscribeEmail &&
        !subscribeEmail.checkValidity()
      ) {

        subscribeEmail.reportValidity();

        return;
      }


      /* -----------------------------------------------
         NORMALIZE
         ----------------------------------------------- */

      const email =
        normalizeEmail(
          rawEmail
        );


      /* -----------------------------------------------
         SUPPORTED DOMAIN CHECK
         ----------------------------------------------- */

      if (
        !isSupportedDomain(
          email
        )
      ) {

        showError(
          "Please use a supported email address such as Gmail, Yahoo, Outlook, or iCloud."
        );

        return;
      }


      /* -----------------------------------------------
         HONEYPOT
         ----------------------------------------------- */

      const honeypot =
        subscribeForm.querySelector(
          'input[name="website"]'
        );


      if (
        honeypot &&
        honeypot.value.trim() !== ""
      ) {

        showError(
          "Submission rejected."
        );

        return;
      }


      /* -----------------------------------------------
         START
         ----------------------------------------------- */

      submissionInProgress =
        true;


      if (
        subscribeError
      ) {

        subscribeError.hidden =
          true;
      }


      if (
        subscribeSuccess
      ) {

        subscribeSuccess.hidden =
          true;
      }


      if (
        subscribeNote
      ) {

        subscribeNote.hidden =
          false;
      }


      if (
        subscribeBtn
      ) {

        subscribeBtn.disabled =
          true;


        subscribeBtn.classList.remove(
          "is-done"
        );


        subscribeBtn.classList.add(
          "is-loading"
        );
      }


      /* =================================================
         CREATE JSONP REQUEST
         ================================================= */

      const script =
        document.createElement(
          "script"
        );


      const requestURL =
        SUBSCRIBE_ENDPOINT +
        "?email=" +
        encodeURIComponent(
          email
        ) +
        "&callback=ajoySubscriptionCallback" +
        "&_=" +
        Date.now();


      script.src =
        requestURL;


      script.async =
        true;


      activeScript =
        script;


      /* -----------------------------------------------
         NETWORK ERROR
         ----------------------------------------------- */

      script.onerror =
        () => {

          if (
            !submissionInProgress
          ) {
            return;
          }


          showFailure(
            "The subscription service could not be reached. Please try again."
          );
        };


      /* -----------------------------------------------
         CLEAN UP
         ----------------------------------------------- */

      script.onload =
        () => {

          window.setTimeout(
            () => {

              if (
                script.parentNode
              ) {

                script.remove();
              }


              if (
                activeScript ===
                script
              ) {

                activeScript =
                  null;
              }

            },
            100
          );
        };


      document.head.appendChild(
        script
      );


      /* =================================================
         SAFETY TIMEOUT
         ================================================= */

      clearTimer();


      submissionTimer =
        window.setTimeout(
          () => {

            if (
              submissionInProgress
            ) {

              showFailure(
                "The subscription service did not respond. Please try again."
              );
            }

          },
          20000
        );
    }
  );
}

/* =========================================================
   MEDIA PROTECTION
   Discourage casual saving/downloading of portfolio media
   ========================================================= */

(function protectMedia() {

  /* -------------------------------------------------------
     Disable right-click on the page
     ------------------------------------------------------- */

  document.addEventListener(
    "contextmenu",
    (event) => {
      event.preventDefault();
    },
    true
  );


  /* -------------------------------------------------------
     Prevent drag/drop of images and videos
     ------------------------------------------------------- */

  document.addEventListener(
    "dragstart",
    (event) => {

      const target = event.target;

      if (
        target instanceof HTMLImageElement ||
        target instanceof HTMLVideoElement
      ) {
        event.preventDefault();
      }
    },
    true
  );


  document.addEventListener(
    "dragover",
    (event) => {

      if (
        event.target instanceof HTMLImageElement ||
        event.target instanceof HTMLVideoElement
      ) {
        event.preventDefault();
      }
    },
    true
  );


  /* -------------------------------------------------------
     Prevent common save / view-source shortcuts
     ------------------------------------------------------- */

  document.addEventListener(
    "keydown",
    (event) => {

      const key =
        String(event.key || "").toLowerCase();


      /*
       * Ctrl/Cmd + S
       * Save page
       */

      if (
        (event.ctrlKey || event.metaKey) &&
        key === "s"
      ) {
        event.preventDefault();
        return;
      }


      /*
       * Ctrl/Cmd + U
       * View source
       */

      if (
        (event.ctrlKey || event.metaKey) &&
        key === "u"
      ) {
        event.preventDefault();
        return;
      }
    },
    true
  );


  /* -------------------------------------------------------
     Protect all current and future media
     ------------------------------------------------------- */

  function protectMediaElement(
    element
  ) {

    if (
      !element ||
      element.dataset.protected === "true"
    ) {
      return;
    }


    element.dataset.protected =
      "true";


    /*
     * Prevent browser dragging.
     */

    element.setAttribute(
      "draggable",
      "false"
    );


    /*
     * Prevent picture-in-picture on videos.
     */

    if (
      element instanceof HTMLVideoElement
    ) {

      element.disablePictureInPicture =
        true;

      element.setAttribute(
        "disablepictureinpicture",
        ""
      );


      /*
       * Tell compatible browsers not to show
       * download controls.
       */

      element.setAttribute(
        "controlsList",
        "nodownload noplaybackrate"
      );


      /*
       * Do not allow remote casting.
       */

      element.disableRemotePlayback =
        true;


      element.setAttribute(
        "disableremoteplayback",
        ""
      );
    }
  }


  function protectAllMedia() {

    document
      .querySelectorAll(
        "img, video"
      )
      .forEach(
        protectMediaElement
      );
  }


  protectAllMedia();


  /* -------------------------------------------------------
     Watch for dynamically-added media
     ------------------------------------------------------- */

  if (
    "MutationObserver" in window
  ) {

    const observer =
      new MutationObserver(
        (mutations) => {

          for (
            const mutation of mutations
          ) {

            mutation.addedNodes.forEach(
              (node) => {

                if (
                  node.nodeType !== 1
                ) {
                  return;
                }


                if (
                  node.matches?.(
                    "img, video"
                  )
                ) {

                  protectMediaElement(
                    node
                  );
                }


                node
                  .querySelectorAll?.(
                    "img, video"
                  )
                  .forEach(
                    protectMediaElement
                  );
              }
            );
          }
        }
      );


    observer.observe(
      document.body,
      {
        childList: true,
        subtree: true
      }
    );
  }


  /* -------------------------------------------------------
     Extra video protection
     ------------------------------------------------------- */

  document
    .querySelectorAll("video")
    .forEach(
      (video) => {

        /*
         * Prevent the browser PiP API if somebody
         * attempts to invoke it programmatically.
         */

        video.addEventListener(
          "enterpictureinpicture",
          () => {

            try {
              document.exitPictureInPicture();
            } catch {}
          }
        );


        /*
         * Some browsers expose a PiP button through
         * their video UI. Explicitly disable it where
         * supported.
         */

        if (
          "disablePictureInPicture" in video
        ) {

          video.disablePictureInPicture =
            true;
        }
      }
    );

})();
