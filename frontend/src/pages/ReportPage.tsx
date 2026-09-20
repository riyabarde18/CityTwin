import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { postObservation } from '../api';
import { EventItem } from '../types';
import { getCategoryMeta } from '../utils/categoryConfig';
import { useAuth } from '../context/AuthContext';
import { Camera, MapPin, Send, Navigation, CheckCircle2, AlertCircle, Building2, ShieldCheck, Trophy } from 'lucide-react';

// Location Pin Selector helper
const LocationMarker: React.FC<{
  position: [number, number];
  setPosition: (pos: [number, number]) => void;
}> = ({ position, setPosition }) => {
  useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
    },
  });

  return <Marker position={position} />;
};

export const ReportPage: React.FC = () => {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [submitterId, setSubmitterId] = useState('citizen_mobile_01');
  const [position, setPosition] = useState<[number, number]>([37.7749, -122.4194]);
  const [loading, setLoading] = useState(false);
  const [resultEvents, setResultEvents] = useState<EventItem[] | null>(null);
  const [pointsAwarded, setPointsAwarded] = useState<number | null>(null);
  const [spamNotice, setSpamNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
    }
  };

  const handleUseMyLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPosition([pos.coords.latitude, pos.coords.longitude]);
        },
        (err) => {
          setErrorMsg('Geolocation access denied or unavailable. Please click location on map.');
        }
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setResultEvents(null);
    setPointsAwarded(null);
    setSpamNotice(null);

    try {
      const formData = new FormData();
      if (file) {
        formData.append('image', file);
      }
      if (description) {
        formData.append('text', description);
      }
      formData.append('lat', position[0].toString());
      formData.append('lon', position[1].toString());
      // Logged-in users are attributed by their verified phone number
      // server-side regardless of this field (see api.ts's auth interceptor
      // + backend create_observation); it's only used for anonymous reports.
      if (!user) {
        formData.append('submitter_id', submitterId);
      }
      formData.append('timestamp', new Date().toISOString());

      const result = await postObservation(formData);
      setResultEvents(result.events);
      if (user) {
        setPointsAwarded(result.points_awarded);
      }
      if (result.is_spam) {
        setSpamNotice(result.spam_reason || 'This report was flagged and did not earn points.');
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to submit observation report.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-2 space-y-6">

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-5">
        
        {/* Submitter Identity */}
        {user ? (
          <div className="flex items-center space-x-2 px-3 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-xs text-emerald-800">
              Reporting as <span className="font-bold">{user.phone_number}</span> (verified)
            </span>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-1.5">
              <span>Submitter Identifier</span>
              <span className="text-[10px] font-normal text-slate-400">(or sign in with your phone above for a verified, trackable report)</span>
            </label>
            <input
              type="text"
              required
              value={submitterId}
              onChange={(e) => setSubmitterId(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
              placeholder="e.g. citizen_user_101"
            />
          </div>
        )}

        {/* Media Upload */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Photo / Media (Optional)
          </label>
          
          <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center hover:border-sky-500 transition cursor-pointer relative bg-slate-50">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            {previewUrl ? (
              <div className="space-y-2">
                <img
                  src={previewUrl}
                  alt="Upload preview"
                  className="max-h-48 mx-auto rounded-lg object-cover shadow-sm"
                />
                <p className="text-[11px] text-sky-600 font-medium">Click or drag to replace photo</p>
              </div>
            ) : (
              <div className="space-y-1.5 py-2">
                <Camera className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-xs font-semibold text-slate-700">Click to upload or drag & drop photo</p>
                <p className="text-[10px] text-slate-400">Supports JPG, PNG, WEBP</p>
              </div>
            )}
          </div>
        </div>

        {/* Location Picker */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1">
              <MapPin className="w-3.5 h-3.5 text-sky-600" />
              <span>Location Picker (Click on map to drop pin)</span>
            </label>
            <button
              type="button"
              onClick={handleUseMyLocation}
              className="inline-flex items-center space-x-1 text-[11px] font-semibold text-sky-600 hover:text-sky-800"
            >
              <Navigation className="w-3 h-3" />
              <span>Use my location</span>
            </button>
          </div>

          <div className="h-48 w-full rounded-xl overflow-hidden border border-slate-300">
            <MapContainer
              center={position}
              zoom={15}
              scrollWheelZoom={false}
              className="w-full h-full"
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <LocationMarker position={position} setPosition={setPosition} />
            </MapContainer>
          </div>
          <p className="text-[10px] text-slate-500 text-right">
            Selected GPS: {position[0].toFixed(5)}, {position[1].toFixed(5)}
          </p>
        </div>

        {/* Optional Description */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Short Description (Optional)
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Pothole with standing water near sidewalk curb"
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 active:bg-sky-800 shadow-md shadow-sky-200 flex items-center justify-center space-x-2 disabled:opacity-50 transition"
        >
          {loading ? (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span>Submit Observation Report</span>
            </>
          )}
        </button>

      </form>

      {/* Error Message */}
      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2 text-xs text-rose-700">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Spam / anti-abuse notice */}
      {spamNotice && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center space-x-2 text-xs text-amber-800">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{spamNotice}</span>
        </div>
      )}

      {/* Points earned banner */}
      {pointsAwarded !== null && pointsAwarded > 0 && (
        <div className="bg-gradient-to-r from-amber-400 to-amber-500 text-white p-4 rounded-2xl shadow-md flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-white/20 rounded-full">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-extrabold">+{pointsAwarded} points earned!</p>
              <p className="text-[11px] text-amber-50/90">See your total in the Earn Points section below.</p>
            </div>
          </div>
          <a href="#rewards" className="text-[11px] font-bold underline underline-offset-2 whitespace-nowrap">
            View progress
          </a>
        </div>
      )}

      {/* AI Extraction Result Chips */}
      {resultEvents && resultEvents.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-300 p-4 rounded-2xl space-y-3">
          <div className="flex items-center space-x-2 text-xs font-bold text-emerald-900">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>AI Perception Extraction Complete!</span>
          </div>

          <div className="space-y-2">
            {resultEvents.map((ev, idx) => {
              const meta = getCategoryMeta(ev.category);
              return (
                <div key={idx} className="bg-white p-3 rounded-xl border border-emerald-100 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${meta.bgColor} ${meta.color}`}>
                        {meta.label}
                      </span>
                      <span className="text-xs text-slate-700 font-medium">{ev.description}</span>
                    </div>
                    <div className="text-right text-[11px]">
                      <span className="font-bold text-slate-800 block">Sev: {ev.severity}/5</span>
                      <span className="text-emerald-600 font-semibold">{Math.round(ev.confidence * 100)}% Conf</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1.5 text-[11px] bg-indigo-50 border border-indigo-100 rounded-lg px-2 py-1.5 text-indigo-800">
                    <Building2 className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      Automatically routed to <span className="font-bold">{ev.assigned_department}</span> — <span className="font-bold">{ev.assigned_zone}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-emerald-700/80">
            No waiting for pattern detection — each report above was sent to its responsible department the moment it was submitted. Track it anytime from "My Reports".
          </p>
        </div>
      )}

    </div>
  );
};
