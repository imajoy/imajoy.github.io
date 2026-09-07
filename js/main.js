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
      root.classList.contains("light") ? "light" : "dark"
    );
  });
}

/* =========================================================
   MOBILE NAV
   ========================================================= */

const menuBtn = document.getElementById("menuBtn");
const mobileNav = document.getElementById("mobileNav");

if (menuBtn && mobileNav) {
  menuBtn.addEventListener("click", () => {
    const open = mobileNav.classList.toggle("open");

    menuBtn.setAttribute(
      "aria-expanded",
      String(open)
    );
  });

  mobileNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      mobileNav.classList.remove("open");
      menuBtn.setAttribute("aria-expanded", "false");
    });
  });
}

/* =========================================================
   YEAR
   ========================================================= */

const yearElement = document.getElementById("year");

if (yearElement) {
  yearElement.textContent = new Date().getFullYear();
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
    if (scrollTicking) return;

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

          const x =
            event.clientX - rect.left;

          const y =
            event.clientY - rect.top;

          card.style.setProperty(
            "--mx",
            `${x}px`
          );

          card.style.setProperty(
            "--my",
            `${y}px`
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
          const video = entry.target;

          if (entry.isIntersecting) {
            video.play().catch(() => {});
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

  modalPlayer.play().catch(() => {});
}

function closeVideoModal() {
  if (!videoModal || !modalPlayer) {
    return;
  }

  videoModal.classList.remove("open");

  videoModal.setAttribute(
    "aria-hidden",
    "true"
  );

  document.body.style.overflow = "";

  modalPlayer.pause();

  modalPlayer.removeAttribute("src");

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
    .querySelectorAll("[data-close]")
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
      videoModal.classList.contains("open")
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
      filterButtons.forEach((item) => {
        item.classList.remove(
          "active"
        );

        item.setAttribute(
          "aria-selected",
          "false"
        );
      });

      button.classList.add("active");

      button.setAttribute(
        "aria-selected",
        "true"
      );

      const selectedPlatform =
        button.dataset.filter;

      toolGroups.forEach((group) => {
        const shouldShow =
          selectedPlatform === "all" ||
          group.dataset.platform ===
            selectedPlatform;

        group.classList.toggle(
          "is-hidden",
          !shouldShow
        );
      });
    }
  );
});

/* =========================================================
   SUBSCRIBE
   Google Apps Script Web App
   ========================================================= */

const SUBSCRIBE_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbzq2ox5khIkCLkfKTYuZrc4zpoPPoE4KYyqvwfM5nkCQ40C0aoYB6A8BGQMZ_nxKmgQTg/exec";

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

  /*
   * Hidden iframe used as the target for
   * the normal HTML POST.
   *
   * This avoids CORS problems between
   * GitHub Pages and Google Apps Script.
   */

  const subscribeFrame =
    document.createElement("iframe");

  subscribeFrame.name =
    "ajoySubscribeFrame";

  subscribeFrame.title =
    "Subscription submission";

  subscribeFrame.setAttribute(
    "aria-hidden",
    "true"
  );

  Object.assign(
    subscribeFrame.style,
    {
      position: "absolute",
      width: "1px",
      height: "1px",
      border: "0",
      opacity: "0",
      pointerEvents: "none",
      left: "-9999px",
      top: "-9999px",
    }
  );

  document.body.appendChild(
    subscribeFrame
  );

  let submissionInProgress =
    false;

  let submissionTimeout =
    null;

  /*
   * Particle animation
   */

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
      "var(--accent)",
    ];

    for (let i = 0; i < 14; i++) {
      const particle =
        document.createElement(
          "span"
        );

      particle.className =
        "subscribe-particle";

      const angle =
        (Math.PI * 2 * i) / 14 +
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
        { once: true }
      );
    }
  }

  /*
   * Successful subscription state
   */

  function showSubscribedState(
    email
  ) {
    submissionInProgress =
      false;

    if (submissionTimeout) {
      clearTimeout(
        submissionTimeout
      );

      submissionTimeout = null;
    }

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

    if (subscribeSuccess) {
      subscribeSuccess.hidden =
        false;
    }
  }

  /*
   * Error state
   */

  function showSubscribeError() {
    submissionInProgress =
      false;

    if (submissionTimeout) {
      clearTimeout(
        submissionTimeout
      );

      submissionTimeout = null;
    }

    if (subscribeBtn) {
      subscribeBtn.disabled =
        false;

      subscribeBtn.classList.remove(
        "is-loading",
        "is-done"
      );
    }

    if (subscribeError) {
      subscribeError.hidden =
        false;
    }
  }

  /*
   * The iframe receives the response
   * from Google Apps Script.
   *
   * Because the iframe is cross-origin,
   * we intentionally do not try to read
   * its contents.
   */

  subscribeFrame.addEventListener(
    "load",
    () => {
      if (
        !submissionInProgress
      ) {
        return;
      }

      const email =
        subscribeEmail?.value.trim() ||
        "";

      if (!email) {
        showSubscribeError();
        return;
      }

      if (subscribeBtn) {
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
       * Save locally only after the
       * Google Apps Script POST has
       * completed its navigation.
       */

      localStorage.setItem(
        "ajoy-subscribed-email",
        email
      );

      window.setTimeout(
        () => {
          showSubscribedState(
            email
          );
        },
        550
      );
    }
  );

  /*
   * Submit subscription
   */

  subscribeForm.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();

      const email =
        subscribeEmail?.value.trim() ||
        "";

      if (!email) {
        subscribeEmail?.focus();
        return;
      }

      if (
        subscribeEmail &&
        !subscribeEmail.checkValidity()
      ) {
        subscribeEmail.reportValidity();
        return;
      }

      /*
       * Prevent double-click submissions.
       */

      if (
        submissionInProgress
      ) {
        return;
      }

      submissionInProgress =
        true;

      if (subscribeError) {
        subscribeError.hidden =
          true;
      }

      if (subscribeSuccess) {
        subscribeSuccess.hidden =
          true;
      }

      if (subscribeNote) {
        subscribeNote.hidden =
          false;
      }

      if (subscribeBtn) {
        subscribeBtn.disabled =
          true;

        subscribeBtn.classList.remove(
          "is-done"
        );

        subscribeBtn.classList.add(
          "is-loading"
        );
      }

      /*
       * Configure a native HTML POST.
       */

      subscribeForm.method =
        "POST";

      subscribeForm.action =
        SUBSCRIBE_ENDPOINT;

      subscribeForm.target =
        subscribeFrame.name;

      /*
       * Use the native submit method so
       * this does not recursively trigger
       * our submit event listener.
       */

      HTMLFormElement.prototype.submit.call(
        subscribeForm
      );

      /*
       * Safety timeout.
       *
       * If Google never returns a response,
       * don't leave the button spinning forever.
       */

      submissionTimeout =
        window.setTimeout(
          () => {
            if (
              submissionInProgress
            ) {
              showSubscribeError();
            }
          },
          12000
        );
    }
  );
}
