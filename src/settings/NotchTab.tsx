import { useEffect, useState } from "react";
import {
	PanelTop,
	Hourglass,
	MousePointer2,
	CalendarSync,
	Calendar,
	BellRing,
	Music,
	Minimize2,
	LayoutList,
	Sparkles,
	Circle,
	CloudSun,
	Timer,
	Archive,
	X
} from "lucide-react";
import { SettingRow } from "./SettingRow";
import { StatusWidgetConfig } from "../components/StatusWidgetConfig";
import { parseNotchPanelChoice, type NotchPanelChoice, type WidgetConfig } from "./types";
import { MAX_PAGE_SWITCH_GRACE_MS } from "../pageSwitchGrace";
import type { NotchPanel } from "../notchPanels";
import { PanelOrderList } from "./PanelOrderList";
import { LauncherShortcutSetting } from "./LauncherShortcutSetting";
import { ReminderSettings } from "./ReminderSettings";

// Shown next to the Scroll speed slider (1 … 5).
const SCROLL_SPEED_LABELS = ["Slow", "Relaxed", "Normal", "Quick", "Fast"];

interface NotchTabProps {
	notchMode: string;
	setNotchModeValue: (mode: string) => void;
	notchEdgeDelay: number;
	handleNotchEdgeDelayChange: (val: number) => void;
	scrollSpeed: number;
	handleScrollSpeedChange: (val: number) => void;
	pageSwitchGrace: number;
	handlePageSwitchGraceChange: (val: number) => void;
	panelOrder: NotchPanel[];
	handlePanelOrderChange: (order: NotchPanel[]) => void;
	calendarEnabled: boolean;
	toggleCalendar: () => void;
	notchRememberPanel: boolean;
	toggleNotchRememberPanel: () => void;
	notchDefaultPanel: NotchPanelChoice;
	changeNotchDefaultPanel: (panel: NotchPanelChoice) => void;
	timerSoundEnabled: boolean;
	toggleTimerSound: () => void;
	calendarIcsUrl: string;
	calendarSync: { state: "idle" | "checking" | "ok" | "error"; message: string };
	saveCalendarIcsUrl: (url: string) => void;
	musicModeEnabled: boolean;
	toggleMusicMode: () => void;
	musicCompactNotch: boolean;
	toggleMusicCompactNotch: () => void;
	shelfPersist: boolean;
	toggleShelfPersist: () => void;
	mediaLayout: "classic" | "compact";
	toggleMediaLayout: (layout: "classic" | "compact") => void;
	mediaAmbienceEnabled: boolean;
	toggleAmbience: () => void;
	mediaCompactGlowEnabled: boolean;
	toggleCompactGlow: () => void;
	weatherEnabled: boolean;
	toggleWeather: () => void;
	tempUnitFahrenheit: boolean;
	toggleTempUnit: () => void;
	cityName: string;
	setCityName: (name: string) => void;
	citySearchResults: Array<{ name: string; country: string; latitude: number; longitude: number }>;
	showCityDropdown: boolean;
	setShowCityDropdown: (show: boolean) => void;
	selectCity: (city: {
		name: string;
		country: string;
		latitude: number;
		longitude: number;
	}) => void;
	handleCityClear: () => void;
	statusWidgets: WidgetConfig;
	handleWidgetsChange: (config: WidgetConfig) => void;
}

export function NotchTab({
	notchMode,
	setNotchModeValue,
	notchEdgeDelay,
	handleNotchEdgeDelayChange,
	scrollSpeed,
	handleScrollSpeedChange,
	pageSwitchGrace,
	handlePageSwitchGraceChange,
	panelOrder,
	handlePanelOrderChange,
	calendarEnabled,
	toggleCalendar,
	notchRememberPanel,
	toggleNotchRememberPanel,
	notchDefaultPanel,
	changeNotchDefaultPanel,
	timerSoundEnabled,
	calendarIcsUrl,
	calendarSync,
	saveCalendarIcsUrl,
	toggleTimerSound,
	musicModeEnabled,
	toggleMusicMode,
	musicCompactNotch,
	toggleMusicCompactNotch,
	shelfPersist,
	toggleShelfPersist,
	mediaLayout,
	toggleMediaLayout,
	mediaAmbienceEnabled,
	toggleAmbience,
	mediaCompactGlowEnabled,
	toggleCompactGlow,
	weatherEnabled,
	toggleWeather,
	tempUnitFahrenheit,
	toggleTempUnit,
	cityName,
	setCityName,
	citySearchResults,
	showCityDropdown,
	setShowCityDropdown,
	selectCity,
	handleCityClear,
	statusWidgets,
	handleWidgetsChange
}: NotchTabProps) {
	// Draft of the calendar link; saved on Enter or when the field loses focus.
	const [calendarDraft, setCalendarDraft] = useState(calendarIcsUrl);
	const [calendarFocused, setCalendarFocused] = useState(false);
	useEffect(() => setCalendarDraft(calendarIcsUrl), [calendarIcsUrl]);
	const commitCalendarDraft = () => {
		if (calendarDraft.trim() !== calendarIcsUrl.trim()) saveCalendarIcsUrl(calendarDraft);
	};
	const calendarDesc =
		calendarSync.state !== "idle"
			? calendarSync.message
			: calendarIcsUrl
				? "Linked · events show as dots on the calendar"
				: "Paste your Google Calendar's secret iCal link";

	return (
		<>
			<div className="setting-group-label">Notch</div>
			<div className="setting-group">
				<SettingRow icon={PanelTop} label="Notch Behavior" desc="Choose how the notch appears">
					<select
						className="settings-select"
						value={notchMode}
						onChange={(e) => setNotchModeValue(e.target.value)}
					>
						<option value="fixed">Fixed</option>
						<option value="smart">Smart</option>
						<option value="peek">Peek</option>
					</select>
				</SettingRow>

				{notchMode !== "fixed" && (
					<SettingRow
						icon={Timer}
						label="Peek Delay"
						desc={
							notchEdgeDelay === 0
								? "Reveal instantly on top-edge contact"
								: `Rest on the top edge for ${notchEdgeDelay}ms to reveal`
						}
					>
						<input
							type="range"
							min="0"
							max="800"
							step="50"
							value={notchEdgeDelay}
							onChange={(e) => handleNotchEdgeDelayChange(parseInt(e.target.value))}
							className="settings-slider"
						/>
					</SettingRow>
				)}

				<SettingRow
					icon={MousePointer2}
					label="Scroll Speed"
					desc={`Scroll over the notch to flip panels · ${SCROLL_SPEED_LABELS[scrollSpeed - 1]}`}
				>
					<input
						type="range"
						min="1"
						max="5"
						step="1"
						value={scrollSpeed}
						aria-label="Scroll speed"
						onChange={(e) => handleScrollSpeedChange(parseInt(e.target.value))}
						className="settings-slider"
					/>
				</SettingRow>

				<SettingRow
					icon={Hourglass}
					label="Page Switch Grace"
					desc={
						pageSwitchGrace === 0
							? "Close as soon as the pointer is outside after switching pages"
							: `Stay open ${(pageSwitchGrace / 1000).toFixed(1)} s if switching pages leaves the pointer outside`
					}
				>
					<input
						type="range"
						min="0"
						max={MAX_PAGE_SWITCH_GRACE_MS}
						step="100"
						value={pageSwitchGrace}
						aria-label="Page switch grace period"
						onChange={(e) => handlePageSwitchGraceChange(parseInt(e.target.value))}
						className="settings-slider"
					/>
				</SettingRow>

				<SettingRow
					icon={PanelTop}
					label="Remember Last Panel"
					desc="Reopen the panel you last used; turn off to choose a fixed default"
				>
					<label className="toggle-switch">
						<input type="checkbox" checked={notchRememberPanel} onChange={toggleNotchRememberPanel} />
						<span className="slider"></span>
					</label>
				</SettingRow>

				{!notchRememberPanel && (
					<SettingRow icon={PanelTop} label="Default Panel" desc="Open this panel when you click the notch">
						<select
							className="settings-select"
							value={
								calendarEnabled || (notchDefaultPanel !== "calendar" && notchDefaultPanel !== "timer")
									? notchDefaultPanel
									: "command-center"
							}
							onChange={(e) => changeNotchDefaultPanel(parseNotchPanelChoice(e.target.value))}
						>
							<option value="calendar" disabled={!calendarEnabled}>Calendar</option>
							<option value="timer" disabled={!calendarEnabled}>Timer</option>
							<option value="launcher">Quick Launcher</option>
							<option value="command-center">Command Center</option>
						</select>
					</SettingRow>
				)}

				<SettingRow icon={Calendar} label="Calendar & Timer" desc="Calendar and Pomodoro timer pages">
					<label className="toggle-switch">
						<input type="checkbox" checked={calendarEnabled} onChange={toggleCalendar} />
						<span className="slider"></span>
					</label>
				</SettingRow>

				{calendarEnabled && (
					<SettingRow
						icon={BellRing}
						label="Timer Sound"
						desc="Play a chime when the timer finishes"
					>
						<label className="toggle-switch">
							<input type="checkbox" checked={timerSoundEnabled} onChange={toggleTimerSound} />
							<span className="slider"></span>
						</label>
					</SettingRow>
				)}

				{calendarEnabled && (
					<>
						<SettingRow icon={CalendarSync} label="Google Calendar" desc={calendarDesc}>
							<span
								className={`calendar-link-status state-${calendarIcsUrl ? calendarSync.state : "idle"}`}
								aria-hidden="true"
							/>
						</SettingRow>
						<div className="manual-city-input">
							<div className="city-input-row">
								<input
									type="text"
									className={
										calendarDraft && !calendarFocused ? "calendar-link-input masked" : "calendar-link-input"
									}
									placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
									value={calendarDraft}
									spellCheck={false}
									autoComplete="off"
									onChange={(e) => setCalendarDraft(e.target.value)}
									onFocus={() => setCalendarFocused(true)}
									onBlur={() => {
										setCalendarFocused(false);
										commitCalendarDraft();
									}}
									onKeyDown={(e) => {
										if (e.key === "Enter") e.currentTarget.blur();
										if (e.key === "Escape") {
											setCalendarDraft(calendarIcsUrl);
											e.currentTarget.blur();
										}
									}}
								/>
								{calendarDraft && (
									<button
										className="city-clear-btn"
										onMouseDown={(e) => {
											e.preventDefault();
											setCalendarDraft("");
											saveCalendarIcsUrl("");
										}}
										title="Remove calendar link"
									>
										<X size={10} strokeWidth={2.5} />
									</button>
								)}
							</div>
						</div>
					</>
				)}

				<SettingRow icon={Music} label="Music Mode" desc="Interactive live music widget">
					<label className="toggle-switch">
						<input type="checkbox" checked={musicModeEnabled} onChange={toggleMusicMode} />
						<span className="slider"></span>
					</label>
				</SettingRow>

				{musicModeEnabled && (
					<>
						<SettingRow
							icon={Minimize2}
							label="Compact Mode"
							desc="Show visualizer & artwork when collapsed"
						>
							<label className="toggle-switch">
								<input
									type="checkbox"
									checked={musicCompactNotch}
									onChange={toggleMusicCompactNotch}
								/>
								<span className="slider"></span>
							</label>
						</SettingRow>

						<SettingRow icon={LayoutList} label="Media Layout" desc="Choose expanded player style">
							<div className="unit-toggle-minimal wide">
								<span
									className={mediaLayout === "classic" ? "active" : ""}
									onClick={() => toggleMediaLayout("classic")}
								>
									Classic
								</span>
								<span
									className={mediaLayout === "compact" ? "active" : ""}
									onClick={() => toggleMediaLayout("compact")}
								>
									Compact
								</span>
							</div>
						</SettingRow>

						<SettingRow
							icon={Sparkles}
							label="Ambient Glow"
							desc="Colored glow behind expanded album art"
						>
							<label className="toggle-switch">
								<input type="checkbox" checked={mediaAmbienceEnabled} onChange={toggleAmbience} />
								<span className="slider"></span>
							</label>
						</SettingRow>

						<SettingRow
							icon={Circle}
							label="Compact Glow"
							desc="Glow around collapsed thumbnail"
							divider={false}
						>
							<label className="toggle-switch">
								<input
									type="checkbox"
									checked={mediaCompactGlowEnabled}
									onChange={toggleCompactGlow}
								/>
								<span className="slider"></span>
							</label>
						</SettingRow>
					</>
				)}
			</div>

			<div className="setting-group-label">Class Reminders</div>
			<div className="setting-group">
				<ReminderSettings hasCalendar={calendarEnabled && !!calendarIcsUrl.trim()} />
			</div>

			<div className="setting-group-label">Shelf</div>
			<div className="setting-group">
				<SettingRow
					icon={Archive}
					label="Keep Items"
					desc="Keep shelf items after Bloom closes"
					divider={false}
				>
					<label className="toggle-switch">
						<input type="checkbox" checked={shelfPersist} onChange={toggleShelfPersist} />
						<span className="slider"></span>
					</label>
				</SettingRow>
			</div>

			<div className="setting-group-label">Page Order</div>
			<div className="setting-group">
				<div className="panel-order-help">
					Scrolling and the arrows by the clock move through the pages in this order. Drag to
					rearrange.
				</div>
				<PanelOrderList
					order={panelOrder}
					onChange={handlePanelOrderChange}
					disabled={calendarEnabled ? [] : ["calendar", "timer"]}
				/>
				<LauncherShortcutSetting />
			</div>

			<div className="setting-group-label">Weather</div>
			<div className="setting-group">
				<SettingRow
					icon={CloudSun}
					label="Weather Status"
					desc={cityName || "Auto-detect location"}
				>
					<div className="weather-controls">
						<div className="unit-toggle-minimal" onClick={toggleTempUnit}>
							<span className={!tempUnitFahrenheit ? "active" : ""}>C</span>
							<span className={tempUnitFahrenheit ? "active" : ""}>F</span>
						</div>
						<label className="toggle-switch">
							<input type="checkbox" checked={weatherEnabled} onChange={toggleWeather} />
							<span className="slider"></span>
						</label>
					</div>
				</SettingRow>

				{weatherEnabled && (
					<div className="manual-city-input">
						<div className="city-input-row">
							<input
								type="text"
								placeholder="Search city..."
								value={cityName}
								onChange={(e) => setCityName(e.target.value)}
								onFocus={() => citySearchResults.length > 0 && setShowCityDropdown(true)}
								onKeyDown={(e) => {
									if (e.key === "Enter" && citySearchResults.length > 0) {
										e.preventDefault();
										selectCity(citySearchResults[0]);
									}
									if (e.key === "Escape") {
										setShowCityDropdown(false);
									}
								}}
								onBlur={() => setTimeout(() => setShowCityDropdown(false), 150)}
							/>
							{cityName && (
								<button
									className="city-clear-btn"
									onMouseDown={(e) => {
										e.preventDefault();
										handleCityClear();
									}}
									title="Clear city"
								>
									<X size={10} strokeWidth={2.5} />
								</button>
							)}
						</div>
						{showCityDropdown && citySearchResults.length > 0 && (
							<div className="city-dropdown">
								{citySearchResults.map((city) => (
									<button
										key={`${city.name}-${city.latitude}`}
										className="city-dropdown-item"
										onMouseDown={(e) => {
											e.preventDefault();
											selectCity(city);
										}}
									>
										<span className="city-dropdown-name">{city.name}</span>
										<span className="city-dropdown-country">{city.country}</span>
									</button>
								))}
							</div>
						)}
					</div>
				)}
			</div>

			<div className="setting-group-label">Widgets</div>
			<div className="setting-group">
				<StatusWidgetConfig value={statusWidgets} onChange={handleWidgetsChange} />
			</div>
		</>
	);
}
