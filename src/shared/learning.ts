import { getLearningMappingByLabel, saveLearningMapping } from './db';
import { LearningMapping } from './types';

// Hash function to make sure labels are consistently mapped
function getLabelKey(label: string): string {
  return label.trim().toLowerCase();
}

export async function learnUserCorrection(
  label: string,
  correctedFieldPath: string
): Promise<void> {
  if (!label) return;

  const key = getLabelKey(label);
  try {
    const existing = await getLearningMappingByLabel(key);

    if (existing) {
      if (existing.matchedFieldPath === correctedFieldPath) {
        // User confirmed/corrected to the same field, increase confidence
        existing.correctionsCount += 1;
        existing.confidenceScore = Math.min(1.0, existing.confidenceScore + 0.1);
        await saveLearningMapping(existing);
      } else {
        // User corrected to a different field path
        if (existing.correctionsCount <= 1) {
          // Replace it with the new path
          existing.matchedFieldPath = correctedFieldPath;
          existing.correctionsCount = 1;
          existing.confidenceScore = 0.7; // starting score
        } else {
          // Decrement corrections count and confidence
          existing.correctionsCount -= 1;
          existing.confidenceScore = Math.max(0.1, existing.confidenceScore - 0.2);
          
          // If confidence is low, replace with new corrected field path
          if (existing.confidenceScore < 0.4) {
            existing.matchedFieldPath = correctedFieldPath;
            existing.correctionsCount = 1;
            existing.confidenceScore = 0.6;
          }
        }
        await saveLearningMapping(existing);
      }
    } else {
      // Create new mapping
      const newMapping: LearningMapping = {
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
        label: key,
        matchedFieldPath: correctedFieldPath,
        correctionsCount: 1,
        confidenceScore: 0.7
      };
      await saveLearningMapping(newMapping);
    }
  } catch (error) {
    console.error("Failed to update learning database:", error);
  }
}
