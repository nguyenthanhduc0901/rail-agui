import generatedData from './rail-data.json';
import { getCarriageSystems as getLegacyCarriageSystems } from './mockData';

export const trains = generatedData.trains;
export const carriagesByTrain = generatedData.carriagesByTrain;
export const issues = generatedData.issues;
export const navLinks = generatedData.navLinks;

export const getCarriagesByTrain = (trainId) => carriagesByTrain[trainId] || [];

export const getActiveIssuesByCarriage = (trainId, carriageId) =>
  issues.filter(
    (issue) => issue.trainId === trainId && issue.carriageId === carriageId && issue.status !== 'closed',
  );

// Keep existing synthetic subsystem health/trend generator for modal visuals.
export const getCarriageSystems = getLegacyCarriageSystems;
