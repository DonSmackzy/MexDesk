import React from 'react';

const AegisLogo = ({ size = 24, className = '' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 100 100"
    fill="none"
    width={size}
    height={size}
    className={className}
  >
    {/* Shield shape */}
    <path d="M50 5 L90 25 L90 55 C90 75 70 92 50 98 C30 92 10 75 10 55 L10 25 Z" fill="#DC2626"/>
    {/* Inner shield highlight */}
    <path d="M50 12 L83 29 L83 55 C83 72 66 86 50 91 C34 86 17 72 17 55 L17 29 Z" fill="#FFFFFF" opacity="0.12"/>
    {/* Letter A */}
    <path d="M50 28 L34 72 L40 72 L44 60 L56 60 L60 72 L66 72 Z M46 54 L50 38 L54 54 Z" fill="#FFFFFF"/>
  </svg>
);

export default AegisLogo;
