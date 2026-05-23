import React from 'react';
import { Search, MapPin } from 'lucide-react';

interface AirportSearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  isLoading?: boolean;
}

export const AirportSearchInput: React.FC<AirportSearchInputProps> = ({
  id,
  label,
  isLoading = false,
  required = false,
  ...props
}) => {
  return (
    <div className="autocomplete-container">
      <label htmlFor={id} className="form-label">
        <MapPin className="h-3.5 w-3.5 text-primary-400" />
        <span>{label}</span>
        {required && <span className="text-red-500">*</span>}
      </label>
      <div className="autocomplete-input-wrapper">
        <input
          id={id}
          className="form-input autocomplete-input"
          autoComplete="off"
          required={required}
          {...props}
        />
        {isLoading ? (
          <div className="autocomplete-spinner">
            <div className="spinner-mini"></div>
          </div>
        ) : (
          <Search className="absolute right-4 h-4.5 w-4.5 text-slate-500 pointer-events-none" />
        )}
      </div>
    </div>
  );
};
