// AI Triage Service - calls Google Gemini to analyze emergency severity

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

// Priority levels from worst to best
export const PRIORITIES = {
  CRITICAL: { label: "CRITICAL", color: "red", order: 4 },
  HIGH: { label: "HIGH", color: "orange", order: 3 },
  MEDIUM: { label: "MEDIUM", color: "yellow", order: 2 },
  LOW: { label: "LOW", color: "green", order: 1 },
};

const SYSTEM_PROMPT = `You are an emergency medical dispatcher AI assistant for the Lebanese Red Cross.

Your job: analyze emergency request descriptions and assign:
1. Priority level
2. Medical category
3. Brief response suggestion

PRIORITY LEVELS:
- CRITICAL: Life-threatening, immediate response (cardiac arrest, severe bleeding, unconscious, can't breathe, stroke symptoms, severe trauma)
- HIGH: Serious, urgent response (chest pain, difficulty breathing, severe pain, broken bones, allergic reaction, pregnancy complications)
- MEDIUM: Needs medical attention but not immediately life-threatening (moderate injuries, persistent fever, abdominal pain, dehydration)
- LOW: Non-urgent (minor cuts, mild symptoms, transport requests, routine checkups)

CATEGORIES (pick one):
Cardiac, Respiratory, Trauma, Neurological, Bleeding, Burns, Allergic, Pregnancy, Pediatric, Psychiatric, Poisoning, Other

RESPONSE FORMAT (strict JSON only, no markdown, no explanation):
{
  "priority": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
  "category": "Cardiac" | "Respiratory" | "Trauma" | "Neurological" | "Bleeding" | "Burns" | "Allergic" | "Pregnancy" | "Pediatric" | "Psychiatric" | "Poisoning" | "Other",
  "suggestion": "Brief 1-sentence dispatcher action (max 100 chars)",
  "reasoning": "Why you chose this priority (max 100 chars)"
}

If text is unclear or empty, assume MEDIUM priority and category Other.
Be cautious — when in doubt, escalate priority. Better safe than sorry.`;

/**
 * Analyze an emergency description with AI
 * @param {object} emergency - the emergency request document
 * @returns {Promise<object>} { priority, category, suggestion, reasoning }
 */
export async function triageEmergency(emergency) {
  try {
    const apiKey = process.env.REACT_APP_GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error(
        "Gemini API key missing. Add REACT_APP_GEMINI_API_KEY to .env and restart."
      );
    }

    const description = [
      emergency.emergencyType && `Emergency type: ${emergency.emergencyType}`,
      emergency.currentCondition && `Condition: ${emergency.currentCondition}`,
      emergency.patientAge && `Patient age: ${emergency.patientAge}`,
      emergency.patientMedicalHistory &&
        `Medical history: ${emergency.patientMedicalHistory}`,
      emergency.patientBloodType && `Blood type: ${emergency.patientBloodType}`,
    ]
      .filter(Boolean)
      .join("\n");

    if (!description.trim()) {
      return {
        priority: "MEDIUM",
        category: "Other",
        suggestion: "Insufficient information — confirm with patient",
        reasoning: "No description provided",
      };
    }

    const prompt = `${SYSTEM_PROMPT}\n\nEMERGENCY REPORT:\n${description}\n\nReturn JSON only:`;

    let response;
    let attempts = 0;
    const MAX_ATTEMPTS = 3;

    while (attempts < MAX_ATTEMPTS) {
      response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
         generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2000,
            thinkingConfig: {
              thinkingBudget: 0,
            },
          },
        }),
      });

      if (response.ok) {
        break;
      }

      if (response.status === 429) {
        const waitMs = Math.pow(2, attempts) * 5000;
        console.warn(
          `Rate limited. Waiting ${waitMs / 1000}s before retry...`
        );

        await new Promise((resolve) => setTimeout(resolve, waitMs));
        attempts += 1;
        continue;
      }

      const errText = await response.text();
      throw new Error(
        `Gemini API error ${response.status}: ${errText.slice(0, 200)}`
      );
    }

    if (!response || !response.ok) {
      throw new Error("Gemini rate limit hit. Please wait 1 minute and try again.");
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!text) {
      console.warn("Gemini returned empty response", data);
      throw new Error("Gemini returned an empty response.");
    }

    // Try multiple parsing strategies
    let parsed = null;

    // Strategy 1: parse as-is
    try {
      parsed = JSON.parse(text.trim());
    } catch {
      // Strategy 2: strip markdown fences
      try {
        const cleaned = text
          .replace(/^```json\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/\s*```$/i, "")
          .trim();
        parsed = JSON.parse(cleaned);
      } catch {
        // Strategy 3: extract first JSON object using regex
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
          try {
            parsed = JSON.parse(match[0]);
          } catch {
            console.error("All JSON parse strategies failed. Raw text:", text);
            throw new Error(
              "Gemini response was not valid JSON. Raw: " + text.slice(0, 150)
            );
          }
        } else {
          console.error("No JSON object found in response:", text);
          throw new Error(
            "Gemini response was not valid JSON. Raw: " + text.slice(0, 150)
          );
        }
      }
    }

    if (!PRIORITIES[parsed.priority]) {
      parsed.priority = "MEDIUM";
    }

    return {
      priority: parsed.priority || "MEDIUM",
      category: parsed.category || "Other",
      suggestion: (parsed.suggestion || "Assess and dispatch as needed").slice(
        0,
        200
      ),
      reasoning: (parsed.reasoning || "AI triage completed").slice(0, 200),
    };
  } catch (err) {
    console.error("Triage failed:", err);
    throw err;
  }
}

/**
 * Sort emergencies by AI priority, critical first, then newest first
 */
export function sortByPriority(emergencies) {
  return [...emergencies].sort((a, b) => {
    const aPrio = PRIORITIES[a.aiPriority]?.order || 0;
    const bPrio = PRIORITIES[b.aiPriority]?.order || 0;

    if (aPrio !== bPrio) {
      return bPrio - aPrio;
    }

    const aTime = a.createdAt?.seconds || 0;
    const bTime = b.createdAt?.seconds || 0;

    return bTime - aTime;
  });
}