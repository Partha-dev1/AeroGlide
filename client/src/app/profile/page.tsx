'use client';

/**
 * ============================================================
 * USER PROFILE PAGE — AeroGlide Flight Platform
 * ============================================================
 * Premium dark-glassmorphic user profile management page.
 * Features:
 *   - Visual emergency contact & emergency phone binds
 *   - Preset premium aviation avatars (Pilot, Crew, etc.)
 *   - Client-side validation boundaries (RFC email, dates, passport)
 *   - Interactive success / failure alert systems
 *   - Full E2E responsive layouts (stacked mobile, double-column desktop)
 * ============================================================
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUserStore } from '../../store';
import { 
  User, Mail, Phone, Globe, Calendar, Compass, ShieldAlert,
  Loader2, CheckCircle2, AlertCircle, Edit3, Save, Camera, 
  MapPin, Shield, HeartHandshake, Eye, EyeOff
} from 'lucide-react';

// Premium Aviation Avatar Options
const AVATAR_PRESETS = [
  { id: 'pilot', label: 'Captain Pilot', url: 'https://images.unsplash.com/photo-1540569014015-19a7be504e3a?w=150&auto=format&fit=crop&q=80' },
  { id: 'flight_crew', label: 'Cabin Crew', url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80' },
  { id: 'traveler_male', label: 'Frequent Flyer (M)', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80' },
  { id: 'traveler_female', label: 'Frequent Flyer (F)', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80' },
  { id: 'aviation_globe', label: 'Navigator', url: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=150&auto=format&fit=crop&q=80' },
];

export default function UserProfilePage() {
  const router = useRouter();
  const { 
    userId, 
    userEmail,
    userProfile, 
    isLoadingProfile, 
    profileError,
    fetchUserProfile, 
    updateUserProfile 
  } = useUserStore();

  const [isEditing, setIsEditing] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showAvatarSelect, setShowAvatarSelect] = useState(false);

  // Controlled Form State
  const [formData, setFormData] = useState({
    fullName: '',
    phoneNumber: '',
    nationality: '',
    dob: '',
    gender: 'unspecified',
    passportDetails: '',
    emergencyContact: '',
    avatarUrl: ''
  });

  // Re-fetch profile on mount or when userId changes
  useEffect(() => {
    if (!userId) {
      router.push('/');
      return;
    }
    fetchUserProfile();
  }, [userId, fetchUserProfile, router]);

  // Synchronize store profile state to form fields
  useEffect(() => {
    if (userProfile) {
      setFormData({
        fullName: userProfile.full_name || '',
        phoneNumber: userProfile.phone_number || '',
        nationality: userProfile.nationality || '',
        dob: userProfile.dob || '',
        gender: userProfile.gender || 'unspecified',
        passportDetails: userProfile.passport_details || '',
        emergencyContact: userProfile.emergency_contact || '',
        avatarUrl: userProfile.avatar_url || AVATAR_PRESETS[0].url
      });
    }
  }, [userProfile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Form Validation Layer
  const validateForm = (): string | null => {
    if (!formData.fullName.trim()) return 'Full name is required.';
    if (formData.fullName.trim().length < 2) return 'Full name must be at least 2 characters.';
    if (!/^[a-zA-Z\s]+$/.test(formData.fullName.trim())) return 'Full name may only contain letters and spaces.';
    
    if (formData.phoneNumber && !/^\+?[0-9\s\-]{8,15}$/.test(formData.phoneNumber.trim())) {
      return 'Please enter a valid phone number (e.g. +91 9876543210).';
    }
    
    if (formData.dob) {
      const birthDate = new Date(formData.dob);
      const today = new Date();
      if (birthDate > today) return 'Date of Birth cannot be in the future.';
      
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      if (age < 2) return 'Traveler must be at least 2 years old.';
    }

    if (formData.passportDetails && !/^[a-zA-Z0-9]{6,12}$/.test(formData.passportDetails.trim())) {
      return 'Passport number must be alphanumeric and between 6 to 12 characters.';
    }

    return null;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    const validationErr = validateForm();
    if (validationErr) {
      setErrorMsg(validationErr);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setIsSaving(true);
    const success = await updateUserProfile({
      full_name: formData.fullName.trim(),
      phone_number: formData.phoneNumber.trim(),
      nationality: formData.nationality.trim(),
      dob: formData.dob || undefined,
      gender: formData.gender as any,
      passport_details: formData.passportDetails.toUpperCase().trim(),
      emergency_contact: formData.emergencyContact.trim(),
      avatar_url: formData.avatarUrl
    });
    setIsSaving(false);

    if (success) {
      setSuccessMsg('Your traveler profile was updated successfully.');
      setIsEditing(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setErrorMsg(profileError || 'Failed to update traveler profile.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSelectAvatar = (url: string) => {
    setFormData(prev => ({ ...prev, avatarUrl: url }));
    setShowAvatarSelect(false);
    if (!isEditing) {
      // Optimistically update avatar url directly if not in edit mode
      updateUserProfile({ avatar_url: url });
    }
  };

  if (isLoadingProfile && !userProfile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
        <Loader2 className="h-10 w-10 text-cyan-400 animate-spin" />
        <p className="text-slate-400 text-sm font-medium">Securing profile connection…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Back link & Title */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary-400" />
            Traveler Profile Settings
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage your personal credentials, passport sheets, and emergency airline contacts.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/my-bookings')}
            className="px-5 py-2.5 rounded-xl border border-white/10 text-sm font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition"
          >
            My Bookings Dashboard
          </button>
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-primary-500 hover:bg-primary-600 text-white shadow-lg shadow-primary-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Edit3 className="h-4 w-4" />
              Edit Travel Profile
            </button>
          ) : (
            <button
              onClick={() => { setIsEditing(false); setErrorMsg(null); }}
              className="px-5 py-2.5 rounded-xl border border-rose-500/20 text-sm font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-500/5 transition"
            >
              Cancel Edits
            </button>
          )}
        </div>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 p-4.5 rounded-2xl text-sm font-semibold mb-6 animate-fade-in">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg ? (
        <div className="flex items-start gap-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 p-4.5 rounded-2xl text-sm font-semibold mb-6 animate-shake">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-400 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      ) : profileError ? (
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 text-amber-300 p-4.5 rounded-2xl text-sm font-semibold mb-6 animate-fade-in">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-500 mt-0.5" />
          <div>
            <p className="font-extrabold uppercase tracking-wide">Offline / Database Connection Loss</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Failed to sync with profile database ({profileError}). Displaying last known traveler details from local storage.
            </p>
          </div>
        </div>
      ) : null}

      {/* Main Profile Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: Avatar Shield & Emergency Contact summary */}
        <div className="space-y-6">
          
          {/* Card 1: Avatar Details */}
          <div className="rounded-3xl glass-panel p-6 sm:p-8 border border-white/8 shadow-xl text-center relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-primary-500/10 to-transparent rounded-bl-full pointer-events-none"></div>
            
            {/* Avatar container */}
            <div className="relative inline-block mx-auto mb-5">
              <div className="h-32 w-32 rounded-full overflow-hidden border-2 border-primary-500/30 p-1 bg-slate-900 shadow-xl relative">
                <img 
                  src={formData.avatarUrl || AVATAR_PRESETS[0].url} 
                  alt="Traveler avatar" 
                  className="h-full w-full object-cover rounded-full"
                />
              </div>
              <button
                onClick={() => setShowAvatarSelect(!showAvatarSelect)}
                className="absolute bottom-1 right-1 p-2 rounded-xl bg-slate-950/80 hover:bg-slate-950 border border-white/10 text-cyan-400 hover:text-cyan-300 shadow-md transition-all active:scale-[0.9]"
                aria-label="Change profile photo"
              >
                <Camera className="h-4 w-4" />
              </button>
            </div>

            <h3 className="text-xl font-bold text-white tracking-tight">{formData.fullName || 'Passenger'}</h3>
            <p className="text-xs text-primary-400 font-semibold tracking-wider uppercase mt-1">
              Frequent Flyer Member
            </p>
            <div className="flex items-center justify-center gap-2 mt-3.5 px-3 py-1.5 rounded-xl bg-white/3 border border-white/5 max-w-xs mx-auto text-xs text-slate-400">
              <Mail className="h-3.5 w-3.5 shrink-0 text-slate-500" />
              <span className="truncate">{userEmail || 'No email synced'}</span>
            </div>

            {/* Avatar presets dropdown */}
            {showAvatarSelect && (
              <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-sm p-5 flex flex-col justify-center animate-fade-in z-10">
                <h4 className="text-sm font-bold text-slate-300 mb-3.5">Select Premium Aviation Avatar</h4>
                <div className="grid grid-cols-5 gap-3 mb-4">
                  {AVATAR_PRESETS.map((avatar) => (
                    <button
                      key={avatar.id}
                      onClick={() => handleSelectAvatar(avatar.url)}
                      className="relative h-12 w-12 rounded-full overflow-hidden border border-white/10 hover:border-cyan-400 transition"
                      title={avatar.label}
                    >
                      <img src={avatar.url} alt={avatar.label} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowAvatarSelect(false)}
                  className="text-xs text-slate-500 hover:text-slate-300 font-medium"
                >
                  Close Options
                </button>
              </div>
            )}
          </div>

          {/* Card 2: Emergency Contact Summary Widget */}
          <div className="rounded-3xl glass-panel p-6 border border-white/8 shadow-xl">
            <div className="flex items-center gap-3 mb-4.5">
              <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                <HeartHandshake className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Emergency Support Contacts</h4>
                <p className="text-[10px] text-slate-500 uppercase font-semibold">Crisis dispatch network</p>
              </div>
            </div>
            <div className="space-y-3.5">
              <div className="p-3 rounded-xl bg-white/2 border border-white/5 space-y-1">
                <span className="text-[10px] text-slate-500 font-semibold uppercase block">Emergency Contact Name</span>
                <span className="text-sm font-medium text-slate-200 block">
                  {formData.emergencyContact || <span className="text-slate-600 font-normal italic">No contact registered</span>}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-white/2 border border-white/5 space-y-1">
                <span className="text-[10px] text-slate-500 font-semibold uppercase block">Emergency Dispatch Number</span>
                <span className="text-sm font-medium text-slate-200 block flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                  {formData.phoneNumber || <span className="text-slate-600 font-normal italic">No phone registered</span>}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side (2 columns): Dynamic details view & editor */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSave} className="rounded-3xl glass-panel p-6 sm:p-8 border border-white/8 shadow-xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-white/5">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Compass className="h-5 w-5 text-primary-400" />
                Personal Traveler Information
              </h2>
              {isEditing && (
                <span className="px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-primary-500/10 text-primary-400 border border-primary-500/20 tracking-wider uppercase animate-pulse">
                  Editing Active
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Full Name */}
              <div>
                <label className="auth-field-label" htmlFor="fullName">
                  <User className="h-3.5 w-3.5 text-primary-400" />
                  Full Name
                </label>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  required
                  disabled={!isEditing}
                  value={formData.fullName}
                  onChange={handleChange}
                  placeholder="E.g. Captain Partha"
                  className={`form-input text-sm font-medium h-[46px] transition-all disabled:bg-white/1 disabled:text-slate-400 disabled:border-white/5`}
                />
              </div>

              {/* Email (Read-Only) */}
              <div>
                <label className="auth-field-label" htmlFor="email">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  Primary Email (Locked)
                </label>
                <input
                  id="email"
                  type="email"
                  disabled
                  value={userEmail || ''}
                  className="form-input text-sm font-medium h-[46px] bg-white/1 border-white/5 text-slate-500 cursor-not-allowed"
                />
              </div>

              {/* Phone Number */}
              <div>
                <label className="auth-field-label" htmlFor="phoneNumber">
                  <Phone className="h-3.5 w-3.5 text-primary-400" />
                  Phone Number
                </label>
                <input
                  id="phoneNumber"
                  name="phoneNumber"
                  type="tel"
                  disabled={!isEditing}
                  value={formData.phoneNumber}
                  onChange={handleChange}
                  placeholder="E.g. +91 9876543210"
                  className="form-input text-sm font-medium h-[46px] disabled:bg-white/1 disabled:text-slate-400 disabled:border-white/5"
                />
              </div>

              {/* Nationality */}
              <div>
                <label className="auth-field-label" htmlFor="nationality">
                  <Globe className="h-3.5 w-3.5 text-primary-400" />
                  Nationality
                </label>
                <input
                  id="nationality"
                  name="nationality"
                  type="text"
                  disabled={!isEditing}
                  value={formData.nationality}
                  onChange={handleChange}
                  placeholder="E.g. Indian"
                  className="form-input text-sm font-medium h-[46px] disabled:bg-white/1 disabled:text-slate-400 disabled:border-white/5"
                />
              </div>

              {/* Date of Birth */}
              <div>
                <label className="auth-field-label" htmlFor="dob">
                  <Calendar className="h-3.5 w-3.5 text-primary-400" />
                  Date of Birth
                </label>
                <input
                  id="dob"
                  name="dob"
                  type="date"
                  disabled={!isEditing}
                  value={formData.dob}
                  onChange={handleChange}
                  className="form-input text-sm font-medium h-[46px] disabled:bg-white/1 disabled:text-slate-400 disabled:border-white/5 cursor-pointer"
                />
              </div>

              {/* Gender */}
              <div>
                <label className="auth-field-label" htmlFor="gender">
                  <Compass className="h-3.5 w-3.5 text-primary-400" />
                  Gender
                </label>
                <select
                  id="gender"
                  name="gender"
                  disabled={!isEditing}
                  value={formData.gender}
                  onChange={handleChange}
                  className="form-input text-sm font-medium h-[46px] bg-slate-900 border-white/10 text-white focus:border-primary-500 disabled:bg-white/1 disabled:text-slate-400 disabled:border-white/5"
                >
                  <option value="unspecified">Select Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Passport Details */}
              <div>
                <label className="auth-field-label" htmlFor="passportDetails">
                  <Shield className="h-3.5 w-3.5 text-primary-400" />
                  Passport Number
                </label>
                <input
                  id="passportDetails"
                  name="passportDetails"
                  type="text"
                  disabled={!isEditing}
                  value={formData.passportDetails}
                  onChange={handleChange}
                  placeholder="E.g. L9876543"
                  className="form-input text-sm font-medium h-[46px] disabled:bg-white/1 disabled:text-slate-400 disabled:border-white/5 uppercase"
                />
              </div>

              {/* Emergency Contact */}
              <div>
                <label className="auth-field-label" htmlFor="emergencyContact">
                  <HeartHandshake className="h-3.5 w-3.5 text-primary-400" />
                  Emergency Contact Name
                </label>
                <input
                  id="emergencyContact"
                  name="emergencyContact"
                  type="text"
                  disabled={!isEditing}
                  value={formData.emergencyContact}
                  onChange={handleChange}
                  placeholder="E.g. Preeti Sarathi"
                  className="form-input text-sm font-medium h-[46px] disabled:bg-white/1 disabled:text-slate-400 disabled:border-white/5"
                />
              </div>
            </div>

            {/* Edit Mode Buttons */}
            {isEditing && (
              <div className="flex items-center justify-end gap-3 pt-5 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => { setIsEditing(false); setErrorMsg(null); }}
                  className="px-5 py-2.5 rounded-xl border border-white/10 text-sm font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-primary-500 hover:bg-primary-600 text-white shadow-lg shadow-primary-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {isSaving ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Saving Changes…</>
                  ) : (
                    <><Save className="h-4 w-4" /> Save Profile</>
                  )}
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
