"use client";

import * as React from "react";
import { createPortal } from "react-dom";

import type { UserMentionOption } from "@/lib/api";
import { cn } from "@/components/ui/cn";

type MentionTextareaFieldProps = Omit<React.ComponentProps<"textarea">, "value" | "onChange"> & {
    label: string;
    value: string;
    onChange: (value: string) => void;
    mentionSearch?: (query: string) => Promise<UserMentionOption[]>;
    wrapperClassName?: string;
    maxSuggestions?: number;
};

type MentionContext = {
    start: number;
    end: number;
    query: string;
};

function hasFieldValue(value: React.ComponentProps<"textarea">["value"]) {
    if (Array.isArray(value)) {
        return value.length > 0;
    }
    return value !== undefined && value !== null && String(value).length > 0;
}

function resolveMentionContext(text: string, caretIndex: number): MentionContext | null {
    const beforeCaret = text.slice(0, caretIndex);
    const atIndex = beforeCaret.lastIndexOf("@");
    if (atIndex < 0) {
        return null;
    }

    if (atIndex > 0) {
        const prev = beforeCaret[atIndex - 1];
        if (!/[\s(]/.test(prev)) {
            return null;
        }
    }

    const query = beforeCaret.slice(atIndex + 1);
    if (query.includes("\n") || query.includes("@")) {
        return null;
    }

    return { start: atIndex, end: caretIndex, query };
}

export function MentionTextareaField({
                                         label,
                                         value,
                                         onChange,
                                         mentionSearch,
                                         wrapperClassName,
                                         className,
                                         maxSuggestions = 8,
                                         onBlur,
                                         onFocus,
                                         disabled,
                                         ...props
                                     }: MentionTextareaFieldProps) {
    const DROPDOWN_MAX_HEIGHT = 256;
    const DROPDOWN_GAP = 8;
    const [isFocused, setIsFocused] = React.useState(false);
    const [context, setContext] = React.useState<MentionContext | null>(null);
    const [suggestions, setSuggestions] = React.useState<UserMentionOption[]>([]);
    const [isOpen, setIsOpen] = React.useState(false);
    const [activeIndex, setActiveIndex] = React.useState(0);
    const [dropdownState, setDropdownState] = React.useState<{
        left: number;
        width: number;
        top: number;
        openAbove: boolean;
    } | null>(null);
    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

    const isFloating = isFocused || hasFieldValue(value);

    React.useEffect(() => {
        if (!mentionSearch || !context) {
            setSuggestions([]);
            setIsOpen(false);
            return;
        }

        const query = context.query.trimStart();

        let active = true;
        const timer = window.setTimeout(() => {
            void mentionSearch(query)
                .then((results) => {
                    if (!active) return;
                    setSuggestions(results.slice(0, maxSuggestions));
                    setActiveIndex(0);
                    setIsOpen(true);
                })
                .catch(() => {
                    if (!active) return;
                    setSuggestions([]);
                    setIsOpen(false);
                });
        }, 180);

        return () => {
            active = false;
            window.clearTimeout(timer);
        };
    }, [context, mentionSearch, maxSuggestions]);

    const updateContext = React.useCallback((text: string, caretIndex: number | null) => {
        if (caretIndex === null) {
            setContext(null);
            return;
        }
        const nextContext = resolveMentionContext(text, caretIndex);
        setContext(nextContext);
    }, []);

    const insertMention = React.useCallback(
        (option: UserMentionOption) => {
            if (!context) return;

            const mentionText = `@${option.username} `;
            const nextValue = `${value.slice(0, context.start)}${mentionText}${value.slice(context.end)}`;
            const nextCaret = context.start + mentionText.length;

            onChange(nextValue);
            setContext(null);
            setSuggestions([]);
            setIsOpen(false);

            window.requestAnimationFrame(() => {
                const textarea = textareaRef.current;
                if (!textarea) return;
                textarea.focus();
                textarea.setSelectionRange(nextCaret, nextCaret);
            });
        },
        [context, onChange, value]
    );

    const updateDropdownPosition = React.useCallback(() => {
        const textarea = textareaRef.current;
        if (!textarea) {
            setDropdownState(null);
            return;
        }

        const rect = textarea.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const openAbove = spaceBelow < DROPDOWN_MAX_HEIGHT + DROPDOWN_GAP && rect.top > spaceBelow;
        const top = openAbove ? rect.top - DROPDOWN_GAP : rect.bottom + DROPDOWN_GAP;

        setDropdownState({
            left: rect.left,
            width: rect.width,
            top,
            openAbove,
        });
    }, []);

    React.useEffect(() => {
        if (!isOpen) {
            return;
        }

        updateDropdownPosition();
        const onWindowChange = () => updateDropdownPosition();
        window.addEventListener("resize", onWindowChange);
        window.addEventListener("scroll", onWindowChange, true);

        return () => {
            window.removeEventListener("resize", onWindowChange);
            window.removeEventListener("scroll", onWindowChange, true);
        };
    }, [isOpen, updateDropdownPosition]);

    return (
        <div className={cn("relative", wrapperClassName)}>
      <textarea
          {...props}
          ref={textareaRef}
          className={cn(
              "h-28 w-full rounded-xl border border-zinc-300 bg-white px-3 pb-2 pt-5 text-sm text-zinc-900 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:border-zinc-300 disabled:bg-zinc-100 disabled:text-zinc-700 disabled:opacity-100 placeholder:text-transparent",
              className
          )}
          disabled={disabled}
          onBlur={(event) => {
              setIsFocused(false);
              window.setTimeout(() => setIsOpen(false), 120);
              onBlur?.(event);
          }}
          onChange={(event) => {
              onChange(event.target.value);
              updateContext(event.target.value, event.target.selectionStart ?? event.target.value.length);
          }}
          onFocus={(event) => {
              setIsFocused(true);
              if (isOpen) {
                  updateDropdownPosition();
              }
              onFocus?.(event);
          }}
          onKeyDown={(event) => {
              if (!isOpen || suggestions.length === 0) {
                  return;
              }

              if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActiveIndex((current) => (current + 1) % suggestions.length);
                  return;
              }

              if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActiveIndex((current) => (current - 1 + suggestions.length) % suggestions.length);
                  return;
              }

              if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  const option = suggestions[activeIndex] ?? suggestions[0];
                  if (option) {
                      insertMention(option);
                  }
                  return;
              }

              if (event.key === "Escape") {
                  event.preventDefault();
                  setIsOpen(false);
                  return;
              }
          }}
          placeholder=" "
          value={value}
      />
            <label
                className={cn(
                    "pointer-events-none absolute left-3 bg-white px-1 text-zinc-500 transition-all duration-150",
                    isFloating ? "-top-2 text-xs text-blue-600" : "top-3.5 text-sm"
                )}
            >
                {label}
            </label>

            {isOpen && context && mentionSearch && typeof document !== "undefined" && dropdownState
                ? createPortal(
                    <div
                        className="fixed z-50 rounded-xl border border-zinc-200 bg-white shadow-xl"
                        style={{
                            left: dropdownState.left,
                            width: dropdownState.width,
                            top: dropdownState.top,
                            transform: dropdownState.openAbove ? "translateY(-100%)" : "none",
                        }}
                    >
                        {suggestions.length > 0 ? (
                            <div className="max-h-64 overflow-y-auto">
                                {suggestions.map((option, index) => {
                                    const isActive = index === activeIndex;
                                    return (
                                        <button
                                            key={option.id}
                                            className={cn(
                                                "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition",
                                                isActive ? "bg-blue-50 text-blue-900" : "hover:bg-zinc-50 text-zinc-800"
                                            )}
                                            onMouseDown={(event) => {
                                                event.preventDefault();
                                                insertMention(option);
                                            }}
                                            type="button"
                                        >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{option.fullName}</span>
                          <span className="block truncate text-xs text-zinc-500">@{option.username}</span>
                        </span>
                                            <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600">Mention</span>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="px-3 py-2 text-sm text-zinc-500">No matching users.</div>
                        )}
                    </div>,
                    document.body
                )
                : null}
        </div>
    );
}
