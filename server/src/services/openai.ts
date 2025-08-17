import OpenAI from "openai";
import { MealAnalysisResult, MealPlanRequest, MealPlanResponse, ReplacementMealRequest } from "../types/openai";
import { extractCleanJSON, parsePartialJSON } from "../utils/openai";

// Initialize OpenAI client
export const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null;

export class OpenAIService {
  static async analyzeMealImage(
    imageBase64: string,
    language: string = "english",
    updateText?: string,
    editedIngredients: any[] = []
  ): Promise<MealAnalysisResult> {
    try {
      console.log("🤖 Starting OpenAI meal analysis...");
      console.log("🌐 Language:", language);
      console.log("📝 Update text provided:", !!updateText);
      console.log("🥗 Edited ingredients count:", editedIngredients.length);

      if (!openai || !process.env.OPENAI_API_KEY) {
        console.log("⚠️ No OpenAI API key, using fallback analysis");
        return this.getFallbackAnalysis(language);
      }

      const isHebrew = language === "hebrew";

      // Build the system prompt
      const systemPrompt = this.buildAnalysisSystemPrompt(isHebrew);

      // Build the user prompt
      const userPrompt = this.buildUserPrompt(
        isHebrew,
        updateText,
        editedIngredients
      );

      console.log("🔄 Calling OpenAI Vision API...");

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: userPrompt,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`,
                  detail: "high",
                },
              },
            ],
          },
        ],
        max_tokens: 2000,
        temperature: 0.1,
      });

      const content = response.choices[0]?.message?.content;

      if (!content || content.trim() === "") {
        console.log("⚠️ Empty response from OpenAI, using fallback");
        return this.getFallbackAnalysis(language);
      }

      console.log("✅ OpenAI response received");
      console.log("📄 Response preview:", content.substring(0, 200) + "...");

      // Parse the JSON response
      const cleanedJSON = extractCleanJSON(content);
      const analysisData = parsePartialJSON(cleanedJSON);

      // Validate and transform the response
      const result = this.transformAnalysisResponse(analysisData, language);

      console.log("✅ Analysis transformation completed");
      console.log("📊 Final result:", {
        name: result.name,
        calories: result.calories,
        confidence: result.confidence,
        ingredientsCount: result.ingredients?.length || 0,
      });

      return result;
    } catch (error) {
      console.error("💥 OpenAI analysis error:", error);
      console.log("🔄 Falling back to default analysis");
      return this.getFallbackAnalysis(language);
    }
  }

  static async updateMealAnalysis(
    originalMeal: any,
    updateText: string,
    language: string = "english"
  ): Promise<MealAnalysisResult> {
    try {
      console.log("🔄 Updating meal analysis with OpenAI...");

      if (!openai || !process.env.OPENAI_API_KEY) {
        console.log("⚠️ No OpenAI API key, using fallback update");
        return this.getFallbackUpdate(originalMeal, updateText, language);
      }

      const isHebrew = language === "hebrew";

      const systemPrompt = isHebrew
        ? `אתה מומחה תזונה המעדכן ניתוח ארוחות. קבל ניתוח קיים ועדכן אותו לפי הבקשה.

החזר JSON בפורמט הזה:
{
  "name": "שם הארוחה המעודכן",
  "description": "תיאור מעודכן",
  "calories": מספר,
  "protein": מספר,
  "carbs": מספר,
  "fat": מספר,
  "fiber": מספר,
  "sugar": מספר,
  "sodium": מספר,
  "confidence": מספר (1-100),
  "ingredients": [{"name": "שם", "calories": מספר, "protein": מספר, "carbs": מספר, "fat": מספר}],
  "servingSize": "גודל מנה",
  "cookingMethod": "שיטת הכנה",
  "healthNotes": "הערות בריאות"
}`
        : `You are a nutrition expert updating meal analysis. Take existing analysis and update it based on the request.

Return JSON in this format:
{
  "name": "updated meal name",
  "description": "updated description",
  "calories": number,
  "protein": number,
  "carbs": number,
  "fat": number,
  "fiber": number,
  "sugar": number,
  "sodium": number,
  "confidence": number (1-100),
  "ingredients": [{"name": "name", "calories": number, "protein": number, "carbs": number, "fat": number}],
  "servingSize": "serving size",
  "cookingMethod": "cooking method",
  "healthNotes": "health notes"
}`;

      const userPrompt = isHebrew
        ? `עדכן את הניתוח הבא:

ניתוח קיים:
- שם: ${originalMeal.name}
- קלוריות: ${originalMeal.calories}
- חלבון: ${originalMeal.protein}ג
- פחמימות: ${originalMeal.carbs}ג
- שומן: ${originalMeal.fat}ג

בקשת עדכון: ${updateText}

עדכן את הניתוח בהתאם לבקשה. אם הבקשה מתייחסת לכמות, עדכן את כל הערכים התזונתיים באופן יחסי.`
        : `Update the following analysis:

Current analysis:
- Name: ${originalMeal.name}
- Calories: ${originalMeal.calories}
- Protein: ${originalMeal.protein}g
- Carbs: ${originalMeal.carbs}g
- Fat: ${originalMeal.fat}g

Update request: ${updateText}

Update the analysis according to the request. If the request refers to quantity, update all nutritional values proportionally.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 1500,
        temperature: 0.1,
      });

      const content = response.choices[0]?.message?.content;

      if (!content) {
        throw new Error("No response from OpenAI");
      }

      const cleanedJSON = extractCleanJSON(content);
      const updateData = parsePartialJSON(cleanedJSON);

      return this.transformAnalysisResponse(updateData, language);
    } catch (error) {
      console.error("💥 OpenAI update error:", error);
      return this.getFallbackUpdate(originalMeal, updateText, language);
    }
  }

  static async generateText(prompt: string, maxTokens: number = 1000): Promise<string> {
    try {
      if (!openai || !process.env.OPENAI_API_KEY) {
        return "AI text generation not available - no API key configured";
      }

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        max_tokens: maxTokens,
        temperature: 0.7,
      });

      return response.choices[0]?.message?.content || "No response generated";
    } catch (error) {
      console.error("Error generating text:", error);
      return "Error generating text response";
    }
  }

  private static buildAnalysisSystemPrompt(isHebrew: boolean): string {
    return isHebrew
      ? `אתה מומחה תזונה מקצועי המנתח תמונות אוכל. נתח את התמונה ותן ניתוח תזונתי מדויק.

החזר JSON בפורמט הזה בלבד:
{
  "name": "שם הארוחה",
  "description": "תיאור קצר",
  "calories": מספר,
  "protein": מספר,
  "carbs": מספר,
  "fat": מספר,
  "fiber": מספר,
  "sugar": מספר,
  "sodium": מספר,
  "confidence": מספר (1-100),
  "ingredients": [{"name": "שם", "calories": מספר, "protein": מספר, "carbs": מספר, "fat": מספר}],
  "servingSize": "גודל מנה",
  "cookingMethod": "שיטת הכנה",
  "healthNotes": "הערות בריאות"
}

הנחיות:
- זהה את כל המרכיבים הנראים
- חשב ערכים תזונתיים מדויקים
- תן ציון ביטחון מ-1 עד 100
- כלול הערות בריאות רלוונטיות`
      : `You are a professional nutrition expert analyzing food images. Analyze the image and provide accurate nutritional analysis.

Return JSON in this format only:
{
  "name": "meal name",
  "description": "brief description",
  "calories": number,
  "protein": number,
  "carbs": number,
  "fat": number,
  "fiber": number,
  "sugar": number,
  "sodium": number,
  "confidence": number (1-100),
  "ingredients": [{"name": "name", "calories": number, "protein": number, "carbs": number, "fat": number}],
  "servingSize": "serving size",
  "cookingMethod": "cooking method",
  "healthNotes": "health notes"
}

Guidelines:
- Identify all visible ingredients
- Calculate accurate nutritional values
- Provide confidence score from 1-100
- Include relevant health notes`;
  }

  private static buildUserPrompt(
    isHebrew: boolean,
    updateText?: string,
    editedIngredients: any[] = []
  ): string {
    let prompt = isHebrew
      ? "נתח את תמונת האוכל הזו ותן ניתוח תזונתי מפורט."
      : "Analyze this food image and provide detailed nutritional analysis.";

    if (updateText) {
      prompt += isHebrew
        ? `\n\nמידע נוסף מהמשתמש: ${updateText}`
        : `\n\nAdditional user information: ${updateText}`;
    }

    if (editedIngredients.length > 0) {
      const ingredientsList = editedIngredients
        .map((ing) => ing.name || ing)
        .join(", ");
      prompt += isHebrew
        ? `\n\nמרכיבים שהמשתמש זיהה: ${ingredientsList}`
        : `\n\nUser-identified ingredients: ${ingredientsList}`;
    }

    return prompt;
  }

  private static transformAnalysisResponse(
    data: any,
    language: string
  ): MealAnalysisResult {
    // Ensure we have valid ingredients array
    const ingredients = Array.isArray(data.ingredients)
      ? data.ingredients.map((ing: any) => ({
          name: ing.name || "Unknown ingredient",
          calories: Number(ing.calories) || 0,
          protein: Number(ing.protein_g || ing.protein) || 0,
          carbs: Number(ing.carbs_g || ing.carbs) || 0,
          fat: Number(ing.fats_g || ing.fat) || 0,
          fiber: Number(ing.fiber_g || ing.fiber) || 0,
          sugar: Number(ing.sugar_g || ing.sugar) || 0,
          sodium_mg: Number(ing.sodium_mg || ing.sodium) || 0,
          protein_g: Number(ing.protein_g || ing.protein) || 0,
          carbs_g: Number(ing.carbs_g || ing.carbs) || 0,
          fats_g: Number(ing.fats_g || ing.fat) || 0,
          fiber_g: Number(ing.fiber_g || ing.fiber) || 0,
          sugar_g: Number(ing.sugar_g || ing.sugar) || 0,
          cholesterol_mg: Number(ing.cholesterol_mg) || 0,
          saturated_fats_g: Number(ing.saturated_fats_g) || 0,
          polyunsaturated_fats_g: Number(ing.polyunsaturated_fats_g) || 0,
          monounsaturated_fats_g: Number(ing.monounsaturated_fats_g) || 0,
          omega_3_g: Number(ing.omega_3_g) || 0,
          omega_6_g: Number(ing.omega_6_g) || 0,
          soluble_fiber_g: Number(ing.soluble_fiber_g) || 0,
          insoluble_fiber_g: Number(ing.insoluble_fiber_g) || 0,
          alcohol_g: Number(ing.alcohol_g) || 0,
          caffeine_mg: Number(ing.caffeine_mg) || 0,
          serving_size_g: Number(ing.serving_size_g) || 0,
          glycemic_index: ing.glycemic_index || null,
          insulin_index: ing.insulin_index || null,
          vitamins_json: ing.vitamins_json || {},
          micronutrients_json: ing.micronutrients_json || {},
          allergens_json: ing.allergens_json || {},
        }))
      : [];

    return {
      name: data.name || "Unknown Meal",
      description: data.description || "",
      calories: Number(data.calories) || 0,
      protein: Number(data.protein) || 0,
      carbs: Number(data.carbs) || 0,
      fat: Number(data.fat) || 0,
      fiber: Number(data.fiber) || 0,
      sugar: Number(data.sugar) || 0,
      sodium: Number(data.sodium) || 0,
      confidence: Number(data.confidence) || 75,
      ingredients,
      servingSize: data.servingSize || "1 serving",
      cookingMethod: data.cookingMethod || "Mixed",
      healthNotes: data.healthNotes || "",
      
      // Additional fields for compatibility
      saturated_fats_g: Number(data.saturated_fats_g) || 0,
      polyunsaturated_fats_g: Number(data.polyunsaturated_fats_g) || 0,
      monounsaturated_fats_g: Number(data.monounsaturated_fats_g) || 0,
      omega_3_g: Number(data.omega_3_g) || 0,
      omega_6_g: Number(data.omega_6_g) || 0,
      soluble_fiber_g: Number(data.soluble_fiber_g) || 0,
      insoluble_fiber_g: Number(data.insoluble_fiber_g) || 0,
      cholesterol_mg: Number(data.cholesterol_mg) || 0,
      alcohol_g: Number(data.alcohol_g) || 0,
      caffeine_mg: Number(data.caffeine_mg) || 0,
      liquids_ml: Number(data.liquids_ml) || 0,
      serving_size_g: Number(data.serving_size_g) || 0,
      allergens_json: data.allergens_json || {},
      vitamins_json: data.vitamins_json || {},
      micronutrients_json: data.micronutrients_json || {},
      additives_json: data.additives_json || {},
      glycemic_index: data.glycemic_index || null,
      insulin_index: data.insulin_index || null,
      food_category: data.food_category || "",
      processing_level: data.processing_level || "",
      cooking_method: data.cookingMethod || "",
      health_risk_notes: data.healthNotes || "",
    };
  }

  private static getFallbackAnalysis(language: string): MealAnalysisResult {
    const isHebrew = language === "hebrew";

    return {
      name: isHebrew ? "ארוחה מנותחת" : "Analyzed Meal",
      description: isHebrew
        ? "ניתוח בסיסי של הארוחה"
        : "Basic meal analysis",
      calories: 400,
      protein: 20,
      carbs: 45,
      fat: 15,
      fiber: 5,
      sugar: 8,
      sodium: 500,
      confidence: 60,
      ingredients: [
        {
          name: isHebrew ? "מרכיבים מעורבים" : "Mixed ingredients",
          calories: 400,
          protein: 20,
          carbs: 45,
          fat: 15,
          fiber: 5,
          sugar: 8,
          sodium_mg: 500,
          protein_g: 20,
          carbs_g: 45,
          fats_g: 15,
          fiber_g: 5,
          sugar_g: 8,
          cholesterol_mg: 0,
          saturated_fats_g: 0,
          polyunsaturated_fats_g: 0,
          monounsaturated_fats_g: 0,
          omega_3_g: 0,
          omega_6_g: 0,
          soluble_fiber_g: 0,
          insoluble_fiber_g: 0,
          alcohol_g: 0,
          caffeine_mg: 0,
          serving_size_g: 0,
          glycemic_index: null,
          insulin_index: null,
          vitamins_json: {},
          micronutrients_json: {},
          allergens_json: {},
        },
      ],
      servingSize: isHebrew ? "מנה אחת" : "1 serving",
      cookingMethod: isHebrew ? "מעורב" : "Mixed",
      healthNotes: isHebrew
        ? "ניתוח בסיסי - הוסף מפתח OpenAI לניתוח מדויק יותר"
        : "Basic analysis - add OpenAI API key for more accurate analysis",
      
      // Additional fields
      saturated_fats_g: 0,
      polyunsaturated_fats_g: 0,
      monounsaturated_fats_g: 0,
      omega_3_g: 0,
      omega_6_g: 0,
      soluble_fiber_g: 0,
      insoluble_fiber_g: 0,
      cholesterol_mg: 0,
      alcohol_g: 0,
      caffeine_mg: 0,
      liquids_ml: 0,
      serving_size_g: 0,
      allergens_json: {},
      vitamins_json: {},
      micronutrients_json: {},
      additives_json: {},
      glycemic_index: null,
      insulin_index: null,
      food_category: "",
      processing_level: "",
      cooking_method: isHebrew ? "מעורב" : "Mixed",
      health_risk_notes: "",
    };
  }

  private static getFallbackUpdate(
    originalMeal: any,
    updateText: string,
    language: string
  ): MealAnalysisResult {
    const isHebrew = language === "hebrew";

    // Simple fallback update logic
    let updatedCalories = originalMeal.calories || 400;
    let updatedProtein = originalMeal.protein || 20;
    let updatedCarbs = originalMeal.carbs || 45;
    let updatedFat = originalMeal.fat || 15;

    // Basic text analysis for quantity changes
    const lowerUpdate = updateText.toLowerCase();
    if (lowerUpdate.includes("half") || lowerUpdate.includes("חצי")) {
      updatedCalories *= 0.5;
      updatedProtein *= 0.5;
      updatedCarbs *= 0.5;
      updatedFat *= 0.5;
    } else if (lowerUpdate.includes("double") || lowerUpdate.includes("כפול")) {
      updatedCalories *= 2;
      updatedProtein *= 2;
      updatedCarbs *= 2;
      updatedFat *= 2;
    }

    return {
      name: originalMeal.name || (isHebrew ? "ארוחה מעודכנת" : "Updated Meal"),
      description: isHebrew ? "ארוחה מעודכנת" : "Updated meal",
      calories: Math.round(updatedCalories),
      protein: Math.round(updatedProtein),
      carbs: Math.round(updatedCarbs),
      fat: Math.round(updatedFat),
      fiber: Math.round((originalMeal.fiber || 5) * (updatedCalories / (originalMeal.calories || 400))),
      sugar: Math.round((originalMeal.sugar || 8) * (updatedCalories / (originalMeal.calories || 400))),
      sodium: Math.round((originalMeal.sodium || 500) * (updatedCalories / (originalMeal.calories || 400))),
      confidence: 65,
      ingredients: originalMeal.ingredients || [],
      servingSize: originalMeal.servingSize || (isHebrew ? "מנה אחת" : "1 serving"),
      cookingMethod: originalMeal.cookingMethod || (isHebrew ? "מעורב" : "Mixed"),
      healthNotes: isHebrew
        ? `עודכן: ${updateText}`
        : `Updated: ${updateText}`,
      
      // Additional fields
      saturated_fats_g: 0,
      polyunsaturated_fats_g: 0,
      monounsaturated_fats_g: 0,
      omega_3_g: 0,
      omega_6_g: 0,
      soluble_fiber_g: 0,
      insoluble_fiber_g: 0,
      cholesterol_mg: 0,
      alcohol_g: 0,
      caffeine_mg: 0,
      liquids_ml: 0,
      serving_size_g: 0,
      allergens_json: {},
      vitamins_json: {},
      micronutrients_json: {},
      additives_json: {},
      glycemic_index: null,
      insulin_index: null,
      food_category: "",
      processing_level: "",
      cooking_method: originalMeal.cookingMethod || (isHebrew ? "מעורב" : "Mixed"),
      health_risk_notes: "",
    };
  }
}