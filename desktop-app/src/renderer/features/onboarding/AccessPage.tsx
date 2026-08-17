import { useEffect, useRef, useState } from "react";

import { useSession } from "../../state/session";
import { OpenAILogoIcon } from "../../ui/AppIcons";

type SnakeDirection = "down" | "left" | "right" | "up";
type SnakePoint = { x: number; y: number };

const snakeVectors: Record<SnakeDirection, SnakePoint> = {
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
};

const oppositeDirection: Record<SnakeDirection, SnakeDirection> = {
  down: "up",
  left: "right",
  right: "left",
  up: "down",
};

function SnakeGame({
  audioContextRef,
  onExit,
}: {
  audioContextRef: React.RefObject<AudioContext | null>;
  onExit(): void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const surface = surfaceRef.current;
    if (!canvas || !surface) return;

    const bounds = surface.getBoundingClientRect();
    const width = Math.max(1, Math.floor(bounds.width));
    const height = Math.max(1, Math.floor(bounds.height));
    const columns = Math.max(12, Math.floor(width / 18));
    const cellSize = width / columns;
    const rows = Math.max(12, Math.floor(height / cellSize));
    const scale = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    canvas.width = Math.floor(width * scale);
    canvas.height = Math.floor(height * scale);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.imageSmoothingEnabled = false;

    const centerX = Math.floor(columns / 2);
    const centerY = Math.floor(rows / 2);
    let snake: SnakePoint[] = [
      { x: centerX, y: centerY },
      { x: centerX - 1, y: centerY },
      { x: centerX - 2, y: centerY },
    ];
    let direction: SnakeDirection = "right";
    let queuedDirection: SnakeDirection = "right";

    const placeFood = (): SnakePoint => {
      let point: SnakePoint;
      do {
        point = {
          x: Math.floor(Math.random() * columns),
          y: Math.floor(Math.random() * rows),
        };
      } while (
        snake.some((segment) => segment.x === point.x && segment.y === point.y)
      );
      return point;
    };

    let food = placeFood();
    const playTone = (
      frequency: number,
      durationMs: number,
      type: OscillatorType,
    ) => {
      const audioContext = audioContextRef.current;
      if (!audioContext) return;
      if (audioContext.state === "suspended") void audioContext.resume();
      const duration = durationMs / 1000;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.18,
        audioContext.currentTime + 0.01,
      );
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        audioContext.currentTime + duration,
      );
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + duration);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    };
    const draw = () => {
      context.clearRect(0, 0, width, height);
      context.fillStyle = "#ffffff";
      for (const segment of snake) {
        context.fillRect(
          segment.x * cellSize,
          segment.y * cellSize,
          cellSize,
          cellSize,
        );
      }
      context.fillStyle = "#ff6764";
      context.fillRect(
        food.x * cellSize,
        food.y * cellSize,
        cellSize,
        cellSize,
      );
    };

    const directionForKey = (key: string): SnakeDirection | null => {
      if (key === "ArrowUp" || key === "w" || key === "W") return "up";
      if (key === "ArrowDown" || key === "s" || key === "S") return "down";
      if (key === "ArrowLeft" || key === "a" || key === "A") return "left";
      if (key === "ArrowRight" || key === "d" || key === "D") return "right";
      return null;
    };

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      const next = directionForKey(event.key);
      if (!next) return;
      event.preventDefault();
      if (oppositeDirection[direction] !== next) queuedDirection = next;
    };

    draw();
    window.addEventListener("keydown", onKeyDown);
    const timer = window.setInterval(() => {
      const head = snake[0];
      if (!head) return;
      const vector = snakeVectors[queuedDirection];
      const next = { x: head.x + vector.x, y: head.y + vector.y };
      const ateFood = next.x === food.x && next.y === food.y;
      const body = ateFood ? snake : snake.slice(0, -1);
      const hitWall =
        next.x < 0 || next.y < 0 || next.x >= columns || next.y >= rows;
      const hitSelf = body.some(
        (segment) => segment.x === next.x && segment.y === next.y,
      );
      if (hitWall || hitSelf) {
        window.clearInterval(timer);
        playTone(hitWall ? 140 : 160, 220, "sawtooth");
        onExit();
        return;
      }
      snake = ateFood ? [next, ...snake] : [next, ...snake.slice(0, -1)];
      direction = queuedDirection;
      if (ateFood) {
        food = placeFood();
        playTone(660, 120, "square");
      }
      draw();
    }, 120);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [audioContextRef, onExit]);

  return (
    <div className="access-snake" ref={surfaceRef}>
      <canvas aria-label="Snake game" ref={canvasRef} />
    </div>
  );
}

export function AccessPage() {
  const { error, signIn, signInWithApiKey } = useSession();
  const [alternate, setAlternate] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [playingSnake, setPlayingSnake] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  const startSnake = () => {
    if (!audioContextRef.current && "AudioContext" in window) {
      audioContextRef.current = new AudioContext();
      if (audioContextRef.current.state === "suspended") {
        void audioContextRef.current.resume();
      }
    }
    setPlayingSnake(true);
  };

  if (playingSnake) {
    return (
      <div className="access-page access-page--snake">
        <SnakeGame
          audioContextRef={audioContextRef}
          onExit={() => setPlayingSnake(false)}
        />
      </div>
    );
  }

  return (
    <div className="access-page">
      <div className="access-page__content">
        <div className="access-page__heading">
          <button
            aria-label="Play Snake"
            className="access-page__logo"
            onClick={startSnake}
            type="button"
          >
            <OpenAILogoIcon aria-hidden="true" />
          </button>
          <h1>Sign in to ChatGPT</h1>
        </div>

        {alternate ? (
          <form
            className="access-page__api-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (apiKey) void signInWithApiKey(apiKey);
            }}
          >
            <label>
              OpenAI API key
              <input
                autoFocus
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="sk-..."
                spellCheck={false}
                type="password"
                value={apiKey}
              />
            </label>
            <div className="access-page__api-actions">
              <button onClick={() => setAlternate(false)} type="button">
                Cancel
              </button>
              <button disabled={!apiKey} type="submit">
                Continue
              </button>
            </div>
          </form>
        ) : (
          <div className="access-page__actions">
            <button
              className="access-page__continue"
              onClick={() => void signIn()}
              type="button"
            >
              <OpenAILogoIcon aria-hidden="true" />
              Continue to sign in
            </button>
            <button
              className="access-page__alternate"
              onClick={() => setAlternate(true)}
              type="button"
            >
              Sign in another way
            </button>
            <button
              className="access-page__signup"
              onClick={() =>
                void window.chatgptDesktop.openExternal(
                  "https://chatgpt.com/auth/login?mode=signup",
                )
              }
              type="button"
            >
              Sign up
            </button>
          </div>
        )}
        {error && <p className="access-page__error">{error}</p>}
      </div>
    </div>
  );
}
