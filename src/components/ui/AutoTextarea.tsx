import {
  useLayoutEffect,
  useRef,
  type TextareaHTMLAttributes,
} from "react";
import clsx from "clsx";

type AutoTextareaProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "rows" | "value"
> & {
  value: string;
};

/**
 * A textarea that grows to fit its content, so a long value is fully readable
 * without scrolling inside the field.
 *
 * Question text routinely runs past what a single-line input can show, and a
 * fixed-height textarea only moves the clipping rather than removing it. The
 * height is recomputed on every value change: reset to `auto` first, because
 * scrollHeight never shrinks below the height already set.
 */
export function AutoTextarea({ value, className, ...props }: AutoTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    // A collapsed ancestor reports 0 and would pin the field shut; leave the
    // height alone until the field is actually laid out.
    if (el.scrollHeight > 0) {
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      className={clsx("resize-none overflow-hidden", className)}
      {...props}
    />
  );
}
