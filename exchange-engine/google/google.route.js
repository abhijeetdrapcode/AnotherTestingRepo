import express from 'express';
import {
  createInstantGoogleMeet,
  deleteCalendarEvent,
  getGoogleCalendarEvents,
  googleCalendarAuth,
  googleMeetAuth,
  handleGoogleCalendarCallback,
  handleGoogleMeetCallback,
  syncGoogleCalendarEvents,
  scheduleCalendarEvent,
} from './google.controller';

const googleRouter = express.Router();

googleRouter.post('/google-calendar/auth', googleCalendarAuth);
googleRouter.get('/google-calendar/auth/callback', handleGoogleCalendarCallback);
googleRouter.post('/google-calendar/events', getGoogleCalendarEvents);
googleRouter.post('/google-calendar/sync-events', syncGoogleCalendarEvents);
googleRouter.post('/google-calendar/schedule-calendar-event', scheduleCalendarEvent);
googleRouter.post('/google-calendar/delete-calendar-event', deleteCalendarEvent);
googleRouter.post('/google-meet/auth', googleMeetAuth);
googleRouter.get('/google-meet/auth/callback', handleGoogleMeetCallback);
googleRouter.post('/google-meet/create-instant-meeting', createInstantGoogleMeet);

export default googleRouter;
