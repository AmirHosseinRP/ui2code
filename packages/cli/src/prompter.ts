import * as p from "@clack/prompts";

/** Thrown when the user cancels (Ctrl+C) during the wizard. */
export class CancelError extends Error {
  constructor() {
    super("Setup cancelled.");
    this.name = "CancelError";
  }
}

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

export interface SpinnerHandle {
  start(message: string): void;
  message(message: string): void;
  stop(message: string): void;
}

/**
 * Minimal prompt interface so the wizard can be driven by @clack/prompts
 * in real runs and by a scripted fake in tests.
 */
export interface Prompter {
  intro(title: string): void;
  note(message: string, title?: string): void;
  warn(message: string): void;
  confirm(message: string, initialValue: boolean): Promise<boolean>;
  select<T extends string>(message: string, options: SelectOption<T>[], initialValue?: T): Promise<T>;
  text(message: string, opts?: { placeholder?: string; defaultValue?: string }): Promise<string>;
  password(message: string): Promise<string>;
  spinner(): SpinnerHandle;
  outro(message: string): void;
}

/** Real prompter backed by @clack/prompts. */
export function createClackPrompter(): Prompter {
  const unwrap = <T>(value: unknown): T => {
    if (p.isCancel(value)) throw new CancelError();
    return value as T;
  };

  return {
    intro(title: string) {
      p.intro(title);
    },
    note(message: string, title?: string) {
      p.note(message, title);
    },
    warn(message: string) {
      p.log.warn(message);
    },
    async confirm(message: string, initialValue: boolean) {
      return unwrap<boolean>(await p.confirm({ message, initialValue }));
    },
    async select<T extends string>(message: string, options: SelectOption<T>[], initialValue?: T) {
      // Note: clack's Option<Value> is a deferred conditional type — it only
      // resolves for concrete Value, so we call select<string> and cast back.
      const clackOptions: Array<{ value: string; label: string; hint?: string }> = [];
      for (const o of options) {
        const opt: { value: string; label: string; hint?: string } = { value: o.value, label: o.label };
        if (o.hint !== undefined) opt.hint = o.hint;
        clackOptions.push(opt);
      }
      const result = await p.select<string>({
        message,
        options: clackOptions,
        initialValue: initialValue as string | undefined,
      });
      return unwrap<T>(result);
    },
    async text(message: string, opts: { placeholder?: string; defaultValue?: string } = {}) {
      return unwrap<string>(
        await p.text({
          message,
          placeholder: opts.placeholder,
          defaultValue: opts.defaultValue,
        })
      );
    },
    async password(message: string) {
      return unwrap<string>(await p.password({ message }));
    },
    spinner() {
      const s = p.spinner();
      return {
        start: (message: string) => s.start(message),
        message: (message: string) => s.message(message),
        stop: (message: string) => s.stop(message),
      };
    },
    outro(message: string) {
      p.outro(message);
    },
  };
}

/**
 * Prompter for non-interactive runs (--yes, CI, pipes).
 * Records the questions it skipped and always takes the provided defaults.
 */
export function createNonInteractivePrompter(log: (message: string) => void = () => {}): Prompter {
  return {
    intro: (title) => log(title),
    note: (message) => log(message),
    warn: (message) => log(`Warning: ${message}`),
    confirm: async (_message, initialValue) => initialValue,
    select: async (_message, _options, initialValue) => {
      if (initialValue !== undefined) return initialValue;
      throw new CancelError();
    },
    text: async (_message, opts) => opts?.defaultValue ?? "",
    password: async () => "",
    spinner: () => ({
      start: (message) => log(message),
      message: (message) => log(message),
      stop: (message) => log(message),
    }),
    outro: (message) => log(message),
  };
}
