import { Check, X } from "lucide-react";
import { useState } from "react";

import { MigrationAura } from "./MigrationAura";

function CodexGlyph({
  className,
  hero = false,
}: {
  className?: string;
  hero?: boolean;
}) {
  const commandFill = hero ? "url(#migration-command-face)" : "currentColor";
  const blossomFill = hero ? "url(#migration-blossom-face)" : "currentColor";
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 20 20"
    >
      {hero && (
        <defs>
          <linearGradient
            id="migration-command-face"
            x1="5"
            x2="14"
            y1="6"
            y2="13"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#c4ccd7" />
            <stop offset="0.5" stopColor="#a8b7ca" />
            <stop offset="1" stopColor="#96a8c0" />
          </linearGradient>
          <linearGradient
            id="migration-blossom-face"
            x1="5"
            x2="14"
            y1="2"
            y2="18"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#c9d0d8" />
            <stop offset="0.28" stopColor="#b1bfce" />
            <stop offset="0.72" stopColor="#9dacc0" />
            <stop offset="1" stopColor="#aab5c2" />
          </linearGradient>
        </defs>
      )}
      <path
        d="M13.333 11.418C13.7002 11.418 13.9978 11.7159 13.998 12.083C13.998 12.4503 13.7003 12.748 13.333 12.748H10.833C10.4657 12.748 10.168 12.4503 10.168 12.083C10.1682 11.7159 10.4659 11.418 10.833 11.418H13.333Z"
        fill={commandFill}
      />
      <path
        d="M6.74121 7.34668C7.0561 7.15796 7.46442 7.26036 7.65332 7.5752L8.90332 9.6582C9.02949 9.86874 9.02961 10.1323 8.90332 10.3428L7.65332 12.4258C7.46441 12.7403 7.05597 12.8427 6.74121 12.6543C6.42637 12.4654 6.32396 12.0561 6.5127 11.7412L7.55664 10L6.5127 8.25879C6.324 7.94395 6.4265 7.53562 6.74121 7.34668Z"
        fill={commandFill}
      />
      <path
        clipRule="evenodd"
        d="M9.00195 1.75C10.1157 1.75021 11.1362 2.15467 11.9238 2.82227C12.1849 2.77516 12.455 2.74903 12.7295 2.74902C15.2262 2.74978 17.2507 4.77449 17.251 7.27148C17.2509 7.54581 17.2238 7.81473 17.1768 8.0752C17.8448 8.86317 18.2499 9.88479 18.25 10.999C18.2496 12.9609 16.9996 14.6284 15.2549 15.2549C14.6285 16.9998 12.9608 18.2497 10.999 18.25C9.88486 18.25 8.86411 17.8448 8.07617 17.1768C7.8155 17.2239 7.54592 17.2509 7.27148 17.251C4.77445 17.2507 2.7504 15.2257 2.75 12.7285C2.75003 12.4539 2.77608 12.1848 2.82324 11.9238C2.20237 11.1913 1.80895 10.2574 1.75684 9.23438L1.75 9.00098C1.75022 7.03932 2.99952 5.36992 4.74414 4.74316C5.37104 2.99851 7.04034 1.75002 9.00195 1.75ZM9.00195 3.07812C7.52474 3.07814 6.27967 4.08156 5.91504 5.44531C5.85362 5.67419 5.67418 5.85363 5.44531 5.91504C4.08208 6.27984 3.07836 7.52408 3.07812 9.00098C3.07826 9.88321 3.43594 10.682 4.01465 11.2607C4.1816 11.4283 4.24663 11.6728 4.18555 11.9014C4.11505 12.1653 4.07719 12.4429 4.07715 12.7285C4.07755 14.4925 5.50753 15.9225 7.27148 15.9229C7.55712 15.9228 7.83548 15.886 8.09961 15.8154L8.18652 15.7979C8.38833 15.7722 8.59297 15.8403 8.73926 15.9863C9.31801 16.5649 10.1168 16.9218 10.999 16.9219C12.4759 16.9216 13.7203 15.9183 14.085 14.5547L14.1133 14.4707C14.1918 14.2821 14.3542 14.1386 14.5547 14.085C15.9181 13.7203 16.9225 12.4758 16.9229 10.999C16.9228 10.1168 16.5648 9.31802 15.9863 8.73926C15.819 8.57175 15.7544 8.3274 15.8154 8.09863C15.886 7.83454 15.9238 7.5568 15.9238 7.27148C15.9235 5.50751 14.4924 4.07762 12.7285 4.07715C12.4424 4.0772 12.164 4.11412 11.9004 4.18457C11.672 4.24541 11.4282 4.18048 11.2607 4.01367C10.7183 3.47141 9.98306 3.12271 9.16699 3.08105L9.00195 3.07812Z"
        fill={blossomFill}
        fillRule="evenodd"
      />
    </svg>
  );
}

function WorkGlyph() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 21 21">
      <path
        clipRule="evenodd"
        d="M6.09967 11.3164C7.57143 11.3164 8.76458 12.5098 8.76471 13.9815C8.76471 15.4533 7.57151 16.6465 6.09967 16.6465C4.62798 16.6463 3.43463 15.4532 3.43463 13.9815C3.43476 12.5099 4.62806 11.3166 6.09967 11.3164ZM6.09967 12.6465C5.3626 12.6467 4.76484 13.2444 4.76471 13.9815C4.76471 14.7187 5.36252 15.3163 6.09967 15.3164C6.83697 15.3164 7.43463 14.7188 7.43463 13.9815C7.4345 13.2443 6.83689 12.6465 6.09967 12.6465Z"
        fill="currentColor"
        fillRule="evenodd"
      />
      <path
        d="M17.7335 13.3301C18.0365 13.392 18.2646 13.6602 18.2647 13.9815C18.2647 14.3029 18.0366 14.5709 17.7335 14.6328L17.5997 14.6465H11.5997C11.2326 14.6463 10.9346 14.3486 10.9346 13.9815C10.9348 13.6144 11.2326 13.3166 11.5997 13.3164H17.5997L17.7335 13.3301Z"
        fill="currentColor"
      />
      <path
        d="M7.89752 3.78207C8.11783 3.48849 8.53542 3.42922 8.82916 3.64925C9.12284 3.86964 9.1823 4.28713 8.96198 4.58089L5.96198 8.58089C5.84631 8.73502 5.66885 8.8309 5.47662 8.84457C5.28452 8.85806 5.09523 8.78836 4.95905 8.65218L3.45905 7.15218L3.37409 7.04769C3.20382 6.78961 3.23191 6.43795 3.45905 6.21078C3.68622 5.98361 4.03786 5.95556 4.29596 6.12582L4.40045 6.21078L5.35748 7.16781L7.89752 3.78207Z"
        fill="currentColor"
      />
      <path
        d="M17.7335 5.73011C18.0365 5.79203 18.2646 6.06015 18.2647 6.38148C18.2647 6.70291 18.0366 6.97091 17.7335 7.03285L17.5997 7.04652H11.5997C11.2326 7.04634 10.9346 6.74864 10.9346 6.38148C10.9348 6.01443 11.2326 5.71662 11.5997 5.71644H17.5997L17.7335 5.73011Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function MigrationModal({ onDismiss }: { onDismiss(): void }) {
  const [keepIcon, setKeepIcon] = useState(true);

  return (
    <div className="migration-backdrop" role="presentation">
      <section
        aria-labelledby="migration-title"
        aria-modal="true"
        className="migration-modal"
        role="dialog"
      >
        <div className="migration-modal__art">
          <MigrationAura />
          <span className="migration-modal__terminal">
            <CodexGlyph hero />
          </span>
          <button aria-label="Close" onClick={onDismiss} type="button">
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="migration-modal__body">
          <h2 id="migration-title">Codex is now the ChatGPT app</h2>
          <div className="migration-modal__rule" />
          <div className="migration-modal__feature">
            <span className="migration-modal__feature-icon">
              <CodexGlyph />
            </span>
            <div>
              <h3>Keep coding with Codex</h3>
              <p>
                Pick up where you left off. Everything you love about Codex is
                still here.
              </p>
            </div>
          </div>
          <div className="migration-modal__feature">
            <span className="migration-modal__feature-icon">
              <WorkGlyph />
            </span>
            <div>
              <h3>Work beyond code</h3>
              <p>
                ChatGPT can now take on work across your apps and create
                polished deliverables.
              </p>
            </div>
          </div>
          <button
            className="migration-modal__start"
            onClick={onDismiss}
            type="button"
          >
            Get started
          </button>
          <label className="migration-modal__checkbox">
            <input
              checked={keepIcon}
              onChange={(event) => setKeepIcon(event.target.checked)}
              type="checkbox"
            />
            <span aria-hidden="true">{keepIcon && <Check />}</span>
            Keep the Codex app icon
          </label>
        </div>
      </section>
    </div>
  );
}
