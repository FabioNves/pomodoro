"use client";
import { motion } from "framer-motion";

export default function Button({
  children,
  onClick,
  variant = "short",
  disabled = false,
  type = "button",
  className = "",
}) {
  const variantStyles = {
    short: "px-6 py-2.5",
    full: "w-full px-6 py-2.5",
  };

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`
        relative overflow-hidden
        bg-[#2563eb] hover:bg-[#1d4ed8]
        text-white font-medium rounded-lg
        shadow-md hover:shadow-lg
        transition-all duration-300
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantStyles[variant]} ${className}
      `}
      whileHover={disabled ? {} : { scale: 1.02 }}
      whileTap={disabled ? {} : { scale: 0.98 }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 25,
      }}
    >
      {/* Simple brightness overlay on hover */}
      <motion.span
        className="absolute inset-0 bg-white rounded-lg opacity-0"
        whileHover={disabled ? {} : { opacity: 0.1 }}
        transition={{ duration: 0.2 }}
      />

      {/* Content */}
      <span className="relative z-10">{children}</span>
    </motion.button>
  );
}
