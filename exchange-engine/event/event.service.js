import { loadEvents, loadEvent } from 'drapcode-utility';

export const allEvents = async (projectId) => {
  return loadEvents(projectId);
};

export const findEvent = async (projectId, eventId) => {
  return loadEvent(projectId, eventId);
};
