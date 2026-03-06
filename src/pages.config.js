/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AssignOfficials from './pages/AssignOfficials';
import BlackoutDates from './pages/BlackoutDates';
import Dashboard from './pages/Dashboard';
import Forfeits from './pages/Forfeits';
import IceSlots from './pages/IceSlots';
import OfficialAvailability from './pages/OfficialAvailability';
import Officials from './pages/Officials';
import Schedule from './pages/Schedule';
import ScheduleBuilder from './pages/ScheduleBuilder';
import TeamsAndDivisions from './pages/TeamsAndDivisions';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AssignOfficials": AssignOfficials,
    "BlackoutDates": BlackoutDates,
    "Dashboard": Dashboard,
    "Forfeits": Forfeits,
    "IceSlots": IceSlots,
    "OfficialAvailability": OfficialAvailability,
    "Officials": Officials,
    "Schedule": Schedule,
    "ScheduleBuilder": ScheduleBuilder,
    "TeamsAndDivisions": TeamsAndDivisions,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};