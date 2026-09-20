import React, { useState, useEffect } from 'react';
import { Navbar } from '../components/Navbar';
import { MapView } from '../components/MapView';
import { CategoryFilter } from '../components/CategoryFilter';
import { PatternDetail } from '../components/PatternDetail';
import { WeatherAnimation } from '../components/WeatherAnimation';
import {
  getEvents,
  getPatterns,
  getPatternDetail,
  seedDatabase,
  analyzePatterns,
  simulateIntervention
} from '../api';
import {
  EventItem,
  PatternSummary,
  PatternDetail as PatternDetailType,
  InterventionResult,
  UrbanCategory
} from '../types';
import { CATEGORY_MAP } from '../utils/categoryConfig';
import { ReportPage } from './ReportPage';
import { MyReportsPage } from './MyReportsPage';
import { DepartmentInboxPage } from './DepartmentInboxPage';
import { TransparencyBar } from '../components/TransparencyBar';
import { LoginModal } from '../components/LoginModal';
import {
  AlertCircle, MapPinned, Radar, Building2, PlusCircle, UserCheck, Inbox, ChevronDown
} from 'lucide-react';

/** A section heading used consistently as you scroll from one part of the platform to the next. */
const SectionHeading: React.FC<{
  icon: React.ElementType; eyebrow: string; title: string; description: string;
}> = ({ icon: Icon, eyebrow, title, description }) => (
  <div className="max-w-3xl mx-auto text-center mb-6 px-4">
    <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-sky-100 text-sky-700 text-[11px] font-bold uppercase tracking-wide">
      <Icon className="w-3.5 h-3.5" />
      <span>{eyebrow}</span>
    </span>
    <h2 className="text-xl sm:text-2xl font-bold text-navy-900 mt-3">{title}</h2>
    <p className="text-sm text-navy-700/70 mt-1.5">{description}</p>
  </div>
);

export const DashboardPage: React.FC = () => {
  const [transparencyRefreshKey, setTransparencyRefreshKey] = useState(0);
  const [showLogin, setShowLogin] = useState(false);

  // Data States
  const [events, setEvents] = useState<EventItem[]>([]);
  const [patterns, setPatterns] = useState<PatternSummary[]>([]);
  const [selectedPatternId, setSelectedPatternId] = useState<string | null>(null);
  const [patternDetailData, setPatternDetailData] = useState<PatternDetailType | null>(null);
  const [interventionResult, setInterventionResult] = useState<InterventionResult | null>(null);

  // UI Controls
  const [viewMode, setViewMode] = useState<'standard' | 'citytwin'>('standard');
  const [selectedCategories, setSelectedCategories] = useState<UrbanCategory[]>(
    Object.keys(CATEGORY_MAP) as UrbanCategory[]
  );

  const [loadingState, setLoadingState] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const isSynthetic = events.some(e => e.is_synthetic) || patterns.some(p => p.is_synthetic);

  useEffect(() => {
    loadEventsAndPatterns();
  }, []);

  const loadEventsAndPatterns = async () => {
    try {
      const fetchedEvents = await getEvents();
      setEvents(fetchedEvents);
      const fetchedPatterns = await getPatterns();
      setPatterns(fetchedPatterns);
      if (fetchedPatterns.length > 0 && !selectedPatternId) {
        handleSelectPattern(fetchedPatterns[0].id);
      }
    } catch (err) {
      console.warn('Backend server disconnected or initializing:', err);
    }
  };

  const handleSelectPattern = async (id: string) => {
    setSelectedPatternId(id);
    setDetailLoading(true);
    try {
      const detail = await getPatternDetail(id);
      setPatternDetailData(detail);
    } catch (err: any) {
      showToast('error', 'Failed to fetch pattern details.');
    } finally {
      setDetailLoading(false);
    }
  };

  const showToast = (type: 'error' | 'success', text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const handleSeed = async () => {
    setLoadingState('seeding');
    setInterventionResult(null);
    try {
      await seedDatabase();
      const newEvents = await getEvents('before');
      setEvents(newEvents);
      setPatterns([]);
      setSelectedPatternId(null);
      setPatternDetailData(null);
      setViewMode('standard');
      showToast('success', 'Demo data loaded successfully (synthetic events)!');
    } catch (err: any) {
      showToast('error', 'Failed to seed demo data. Ensure backend is running.');
    } finally {
      setLoadingState(null);
    }
  };

  const handleAnalyze = async () => {
    setLoadingState('analyzing');
    setInterventionResult(null);
    try {
      const detectedPatterns = await analyzePatterns();
      setPatterns(detectedPatterns);
      setViewMode('citytwin');
      setTransparencyRefreshKey((k) => k + 1);
      if (detectedPatterns.length > 0) {
        handleSelectPattern(detectedPatterns[0].id);
        showToast('success', `CityTwin analysis complete! Detected ${detectedPatterns.length} pattern hotspot.`);
        document.getElementById('pattern-intelligence')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        setSelectedPatternId(null);
        setPatternDetailData(null);
        showToast('error', 'No emerging multi-category patterns met filtering thresholds.');
      }
    } catch (err: any) {
      showToast('error', 'Analysis failed. Please check backend logs.');
    } finally {
      setLoadingState(null);
    }
  };

  const handleSimulate = async () => {
    if (!selectedPatternId) return;
    setLoadingState('simulating');
    try {
      const result = await simulateIntervention(selectedPatternId);
      setInterventionResult(result);
      const updatedEvents = await getEvents();
      setEvents(updatedEvents);
      showToast('success', `Intervention simulated! ${result.overall_reduction_pct}% reduction in problem reports.`);
    } catch (err: any) {
      showToast('error', 'Intervention simulation failed.');
    } finally {
      setLoadingState(null);
    }
  };

  const handlePatternUpdated = (updated: PatternDetailType) => {
    setPatternDetailData(updated);
    setPatterns((prev) =>
      prev.map((p) =>
        p.id === updated.id
          ? {
              ...p,
              status: updated.status,
              assigned_department: updated.assigned_department,
              is_overdue: updated.is_overdue,
              status_updated_at: updated.status_updated_at,
              progress_percent: updated.progress_percent,
            }
          : p
      )
    );
    setTransparencyRefreshKey((k) => k + 1);
  };

  const handleToggleCategory = (cat: UrbanCategory) => {
    if (selectedCategories.includes(cat)) {
      setSelectedCategories(selectedCategories.filter(c => c !== cat));
    } else {
      setSelectedCategories([...selectedCategories, cat]);
    }
  };

  const handleClearAllCategories = () => {
    setSelectedCategories(Object.keys(CATEGORY_MAP) as UrbanCategory[]);
  };

  return (
    <div id="top" className="min-h-screen flex flex-col bg-sky-50">

      <Navbar
        isSynthetic={isSynthetic}
        onSeed={handleSeed}
        onAnalyze={handleAnalyze}
        onSimulate={handleSimulate}
        hasPatternSelected={!!selectedPatternId}
        loadingState={loadingState}
        onOpenLogin={() => setShowLogin(true)}
      />

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}

      {toastMsg && (
        <div className={`fixed top-24 right-6 z-[2000] p-3 rounded-xl shadow-xl border text-xs font-semibold flex items-center space-x-2 animate-bounce ${
          toastMsg.type === 'success'
            ? 'bg-emerald-600 text-white border-emerald-500'
            : 'bg-rose-600 text-white border-rose-500'
        }`}>
          <AlertCircle className="w-4 h-4" />
          <span>{toastMsg.text}</span>
        </div>
      )}

      <main className="flex-1">

        {/* ============ HERO ============ */}
        <section className="relative overflow-hidden">
          <WeatherAnimation />
          <div className="relative z-10 max-w-5xl mx-auto px-4 py-16 sm:py-20 text-center">
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-white/10 text-sky-100 border border-white/20 text-[11px] font-bold uppercase tracking-wide backdrop-blur-sm">
              <MapPinned className="w-3.5 h-3.5" />
              <span>AI-Powered Emergent Urban Problem Detection</span>
            </span>
            <h1 className="text-3xl sm:text-5xl font-extrabold text-white mt-5 tracking-tight drop-shadow-sm">
              City<span className="text-sky-300">Twin</span>
            </h1>
            <p className="text-sm sm:text-base text-sky-50/90 mt-4 max-w-2xl mx-auto leading-relaxed">
              CityTwin doesn't just collect complaints — it looks for unusual combinations of citizen reports, CCTV,
              satellite, weather, and mobility data that reveal an emerging urban problem before it cascades into
              something worse. Scroll down to see it in action.
            </p>
            <div className="mt-7 flex items-center justify-center">
              <a
                href="#map"
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl text-sm font-bold text-navy-900 bg-sky-300 hover:bg-sky-200 shadow-lg transition"
              >
                <span>Explore the live map</span>
                <ChevronDown className="w-4 h-4" />
              </a>
            </div>
          </div>
        </section>

        {/* ============ SECTION: CITY MAP ============ */}
        <section id="map" className="section-anchor py-12 px-4 sm:px-6 lg:px-8">
          <SectionHeading
            icon={MapPinned}
            eyebrow="For citizens & planners"
            title="Live City Map"
            description="Every report — citizen or camera — plotted by category. Switch to CityTwin view to see detected pattern hotspots highlighted."
          />
          <div className="max-w-6xl mx-auto space-y-3">
            <CategoryFilter
              selectedCategories={selectedCategories}
              onToggleCategory={handleToggleCategory}
              onClearAll={handleClearAllCategories}
            />
            <div className="h-[520px] w-full rounded-2xl overflow-hidden shadow-lg border border-navy-100">
              <MapView
                events={events}
                patterns={patterns}
                selectedPatternId={selectedPatternId}
                onSelectPattern={handleSelectPattern}
                viewMode={viewMode}
                setViewMode={setViewMode}
                selectedCategories={selectedCategories}
              />
            </div>
          </div>
        </section>

        {/* ============ SECTION: PATTERN INTELLIGENCE & CASCADE RISK ============ */}
        <section id="pattern-intelligence" className="section-anchor py-12 px-4 sm:px-6 lg:px-8 bg-white">
          <SectionHeading
            icon={Radar}
            eyebrow="For planners & field teams"
            title="Pattern Intelligence & Cascade Risk"
            description="Why a hotspot was flagged, what independent evidence backs it, and — critically — what it could escalate into if left unresolved."
          />
          <div className="max-w-3xl mx-auto">
            <PatternDetail
              pattern={patternDetailData}
              loading={detailLoading}
              interventionResult={interventionResult}
              onPatternUpdated={handlePatternUpdated}
            />
          </div>
        </section>

        {/* ============ SECTION: GOVERNMENT DASHBOARD ============ */}
        <section id="government" className="section-anchor py-12 px-4 sm:px-6 lg:px-8">
          <SectionHeading
            icon={Building2}
            eyebrow="For city leadership — public, no login"
            title="Government Accountability Dashboard"
            description="Every flagged pattern is auto-routed to a responsible department. This is the public record of whether they acted, and how fast."
          />
          <div className="max-w-4xl mx-auto">
            <TransparencyBar refreshKey={transparencyRefreshKey} />
          </div>
        </section>

        {/* ============ SECTION: REPORT AN ISSUE ============ */}
        <section id="report" className="section-anchor py-12 px-4 sm:px-6 lg:px-8 bg-white">
          <SectionHeading
            icon={PlusCircle}
            eyebrow="For citizens"
            title="Report an Issue"
            description="Upload a photo or describe what you see. AI perception classifies it and routes it to the right department instantly."
          />
          <ReportPage />
        </section>

        {/* ============ SECTION: MY REPORTS ============ */}
        <section id="my-reports" className="section-anchor py-12 px-4 sm:px-6 lg:px-8">
          <SectionHeading
            icon={UserCheck}
            eyebrow="For citizens"
            title="My Reports"
            description="Track what happened to what you reported — department, status, and progress toward resolution."
          />
          <MyReportsPage />
        </section>

        {/* ============ SECTION: DEPARTMENT INBOX ============ */}
        <section id="inbox" className="section-anchor py-12 px-4 sm:px-6 lg:px-8 bg-white">
          <SectionHeading
            icon={Inbox}
            eyebrow="For municipal departments"
            title="Department Inbox"
            description="Every report routed to your department, plus proactive risk escalations when an unresolved issue meets severe weather."
          />
          <DepartmentInboxPage />
        </section>

      </main>

      {/* Footer */}
      <footer className="bg-navy-900 text-sky-200/70 py-8 px-4 text-center text-xs">
        <p>CityTwin — an urban anomaly and relationship-discovery engine, not merely a citizen complaint portal.</p>
        <p className="mt-1 text-sky-200/40">Hypotheses for investigation; verification by the relevant city authority required.</p>
      </footer>

    </div>
  );
};
