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
    {/* Rounded indigo badge */}
    <rect width="100" height="100" rx="24" fill="#4F46E5" />
    {/* Clean geometric Letter M */}
    <path
      d="M26 74 V28 H38 L50 52 L62 28 H74 V74 H63 V44 L53 64 H47 L37 44 V74 Z"
      fill="#FFFFFF"
    />
  </svg>
);

export default AegisLogo;
