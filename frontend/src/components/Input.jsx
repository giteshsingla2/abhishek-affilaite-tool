import React from 'react';

const Input = ({ type, placeholder, name, value, onChange, required, minLength }) => {
  return (
    <input
      type={type}
      placeholder={placeholder}
      name={name}
      value={value}
      onChange={onChange}
      required={required}
      minLength={minLength}
      className="w-full p-3 mb-4 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500 transition duration-300"
    />
  );
};

export default Input;
