"use client";

import * as React from "react";

import { cn } from "@/components/ui/cn";
import { Input } from "@/components/ui/input";

function hasFieldValue(value: React.ComponentProps<"input">["value"] | React.ComponentProps<"textarea">["value"]) {
    if (Array.isArray(value)) {
        return value.length > 0;
    }
    return value !== undefined && value !== null && String(value).length > 0;
}

type FloatingInputFieldProps = React.ComponentProps<typeof Input> & {
    label: string;
    wrapperClassName?: string;
};

export function FloatingInputField({ label, wrapperClassName, className, value, onFocus, onBlur, ...props }: FloatingInputFieldProps) {
    const [isFocused, setIsFocused] = React.useState(false);
    const isFloating = isFocused || hasFieldValue(value);

    return (
        <div className={cn("relative", wrapperClassName)}>
            <Input
                {...props}
                className={cn("peer h-11 px-3 pb-1 pt-4 placeholder:text-transparent", className)}
                onBlur={(event) => {
                    setIsFocused(false);
                    onBlur?.(event);
                }}
                onFocus={(event) => {
                    setIsFocused(true);
                    onFocus?.(event);
                }}
                placeholder=" "
                value={value}
            />
            <label
                className={cn(
                    "pointer-events-none absolute left-3 bg-white px-1 text-zinc-500 transition-all duration-150",
                    isFloating ? "-top-2 text-xs text-blue-600" : "top-3 text-sm"
                )}
            >
                {label}
            </label>
        </div>
    );
}

type FixedInputFieldProps = React.ComponentProps<typeof Input> & {
    label: string;
    wrapperClassName?: string;
};

export function FixedInputField({ label, wrapperClassName, className, value, ...props }: FixedInputFieldProps) {
    return (
        <div className={cn("relative", wrapperClassName)}>
            <Input
                {...props}
                className={cn("peer h-11 px-3 pb-1 pt-4", className)}
                placeholder=" "
                value={value}
            />
            <label className="pointer-events-none absolute left-3 -top-2 bg-white px-1 text-xs text-zinc-500">{label}</label>
        </div>
    );
}

type FloatingTextareaFieldProps = React.ComponentProps<"textarea"> & {
    label: string;
    wrapperClassName?: string;
};

export function FloatingTextareaField({
                                          label,
                                          wrapperClassName,
                                          className,
                                          value,
                                          onFocus,
                                          onBlur,
                                          ...props
                                      }: FloatingTextareaFieldProps) {
    const [isFocused, setIsFocused] = React.useState(false);
    const isFloating = isFocused || hasFieldValue(value);

    return (
        <div className={cn("relative", wrapperClassName)}>
      <textarea
          {...props}
          className={cn(
              "h-28 w-full rounded-xl border border-zinc-300 bg-white px-3 pb-2 pt-5 text-sm text-zinc-900 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:border-zinc-300 disabled:bg-zinc-100 disabled:text-zinc-700 disabled:opacity-100 placeholder:text-transparent",
              className
          )}
          onBlur={(event) => {
              setIsFocused(false);
              onBlur?.(event);
          }}
          onFocus={(event) => {
              setIsFocused(true);
              onFocus?.(event);
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
        </div>
    );
}

type LabeledSelectFieldProps = React.ComponentProps<"select"> & {
    label: string;
    wrapperClassName?: string;
    labelClassName?: string;
};

export function LabeledSelectField({ label, wrapperClassName, labelClassName, className, children, ...props }: LabeledSelectFieldProps) {
    return (
        <label className={cn("relative block", wrapperClassName)}>
            <span className={cn("pointer-events-none absolute left-3 -top-2 z-10 bg-white px-1 text-xs text-zinc-500", labelClassName)}>{label}</span>
            <select
                {...props}
                className={cn(
                    "h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 pb-1 pt-4 text-sm text-zinc-900 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:border-zinc-300 disabled:bg-zinc-100 disabled:text-zinc-700 disabled:opacity-100",
                    className
                )}
            >
                {children}
            </select>
        </label>
    );
}
