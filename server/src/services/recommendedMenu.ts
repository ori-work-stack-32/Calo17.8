import { prisma } from "../lib/database";
import { OpenAIService } from "./openai";

interface GenerateMenuParams {
  userId: string;
  days?: number;
  mealsPerDay?: string;
  mealChangeFrequency?: string;
  includeLeftovers?: boolean;
  sameMealTimes?: boolean;
  targetCalories?: number;
  dietaryPreferences?: string[];
  excludedIngredients?: string[];
  budget?: number;
  customRequest?: string;
}

interface MealData {
  name: string;
  meal_type: string;
  day_number: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  prep_time_minutes?: number;
  cooking_method?: string;
  instructions?: string;
  ingredients: Array<{
    name: string;
    quantity: number;
    unit: string;
    category?: string;
    estimated_cost?: number;
  }>;
}

export class RecommendedMenuService {
  static async generatePersonalizedMenu(params: GenerateMenuParams) {
    try {
      console.log("🎯 Generating personalized menu for user:", params.userId);

      // Get user's questionnaire data
      const questionnaire = await prisma.userQuestionnaire.findFirst({
        where: { user_id: params.userId },
        orderBy: { date_completed: "desc" },
      });

      if (!questionnaire) {
        throw new Error("User questionnaire not found. Please complete the questionnaire first.");
      }

      // Get user's nutrition goals
      const nutritionPlan = await prisma.nutritionPlan.findFirst({
        where: { user_id: params.userId },
        orderBy: { created_at: "desc" },
      });

      // Calculate target calories if not provided
      const targetCalories = params.targetCalories || 
        nutritionPlan?.goal_calories || 
        this.calculateDefaultCalories(questionnaire);

      // Generate menu using AI or fallback
      const menuData = await this.generateMenuWithAI(params, questionnaire, targetCalories);

      // Save to database
      const savedMenu = await this.saveMenuToDatabase(params.userId, menuData);

      console.log("✅ Personalized menu generated successfully");
      return savedMenu;
    } catch (error) {
      console.error("💥 Error generating personalized menu:", error);
      throw error;
    }
  }

  static async generateCustomMenu(params: GenerateMenuParams) {
    try {
      console.log("🎨 Generating custom menu for user:", params.userId);

      // Get user's questionnaire data
      const questionnaire = await prisma.userQuestionnaire.findFirst({
        where: { user_id: params.userId },
        orderBy: { date_completed: "desc" },
      });

      if (!questionnaire) {
        throw new Error("User questionnaire not found. Please complete the questionnaire first.");
      }

      // Generate custom menu based on request
      const menuData = await this.generateCustomMenuWithAI(params, questionnaire);

      // Save to database
      const savedMenu = await this.saveMenuToDatabase(params.userId, menuData);

      console.log("✅ Custom menu generated successfully");
      return savedMenu;
    } catch (error) {
      console.error("💥 Error generating custom menu:", error);
      throw error;
    }
  }

  private static async generateMenuWithAI(
    params: GenerateMenuParams,
    questionnaire: any,
    targetCalories: number
  ) {
    try {
      if (!process.env.OPENAI_API_KEY) {
        console.log("⚠️ No OpenAI API key, using fallback menu generation");
        return this.generateFallbackMenu(params, targetCalories);
      }

      // Build AI prompt for menu generation
      const prompt = this.buildMenuGenerationPrompt(params, questionnaire, targetCalories);

      const response = await OpenAIService.generateText(prompt, 2000);
      
      // Parse AI response
      const menuData = this.parseMenuResponse(response);
      
      return menuData;
    } catch (error) {
      console.error("💥 AI menu generation failed:", error);
      return this.generateFallbackMenu(params, targetCalories);
    }
  }

  private static async generateCustomMenuWithAI(
    params: GenerateMenuParams,
    questionnaire: any
  ) {
    try {
      if (!process.env.OPENAI_API_KEY) {
        console.log("⚠️ No OpenAI API key, using fallback custom menu");
        return this.generateFallbackCustomMenu(params);
      }

      const prompt = this.buildCustomMenuPrompt(params, questionnaire);
      const response = await OpenAIService.generateText(prompt, 2000);
      const menuData = this.parseMenuResponse(response);
      
      return menuData;
    } catch (error) {
      console.error("💥 AI custom menu generation failed:", error);
      return this.generateFallbackCustomMenu(params);
    }
  }

  private static buildMenuGenerationPrompt(
    params: GenerateMenuParams,
    questionnaire: any,
    targetCalories: number
  ): string {
    return `Generate a ${params.days || 7}-day meal plan with the following requirements:

USER PROFILE:
- Age: ${questionnaire.age}
- Weight: ${questionnaire.weight_kg}kg
- Height: ${questionnaire.height_cm}cm
- Goal: ${questionnaire.main_goal}
- Activity Level: ${questionnaire.physical_activity_level}
- Dietary Style: ${questionnaire.dietary_style}
- Allergies: ${questionnaire.allergies?.join(", ") || "None"}

MENU REQUIREMENTS:
- ${params.mealsPerDay || "3_main"} meals per day
- Target calories: ${targetCalories} per day
- Days: ${params.days || 7}
- Budget: ${params.budget ? `$${params.budget} per day` : "Moderate"}

Return a JSON object with this structure:
{
  "title": "Menu title",
  "description": "Menu description",
  "total_calories": total calories for all days,
  "total_protein": total protein,
  "total_carbs": total carbs,
  "total_fat": total fat,
  "days_count": number of days,
  "estimated_cost": estimated cost,
  "meals": [
    {
      "name": "Meal name",
      "meal_type": "BREAKFAST/LUNCH/DINNER/SNACK",
      "day_number": 1-7,
      "calories": number,
      "protein": number,
      "carbs": number,
      "fat": number,
      "fiber": number,
      "prep_time_minutes": number,
      "cooking_method": "method",
      "instructions": "cooking instructions",
      "ingredients": [
        {
          "name": "ingredient name",
          "quantity": number,
          "unit": "g/ml/cup/etc",
          "category": "protein/vegetable/grain/etc"
        }
      ]
    }
  ]
}`;
  }

  private static buildCustomMenuPrompt(
    params: GenerateMenuParams,
    questionnaire: any
  ): string {
    return `Create a custom meal plan based on this request: "${params.customRequest}"

USER CONTEXT:
- Dietary Style: ${questionnaire.dietary_style}
- Allergies: ${questionnaire.allergies?.join(", ") || "None"}
- Cooking Preference: ${questionnaire.cooking_preference}
- Budget: ${params.budget ? `$${params.budget} per day` : "Flexible"}

REQUIREMENTS:
- ${params.days || 7} days
- ${params.mealsPerDay || "3_main"} meals per day
- Follow the custom request closely
- Ensure nutritional balance

Return the same JSON structure as before with title, description, meals array, etc.`;
  }

  private static parseMenuResponse(response: string) {
    try {
      // Clean and parse JSON response
      const cleanResponse = response
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .trim();

      const menuData = JSON.parse(cleanResponse);
      
      // Validate required fields
      if (!menuData.meals || !Array.isArray(menuData.meals)) {
        throw new Error("Invalid menu structure");
      }

      return menuData;
    } catch (error) {
      console.error("💥 Error parsing menu response:", error);
      throw new Error("Failed to parse AI menu response");
    }
  }

  private static generateFallbackMenu(params: GenerateMenuParams, targetCalories: number) {
    const days = params.days || 7;
    const mealsPerDay = this.getMealsPerDayCount(params.mealsPerDay || "3_main");
    
    const fallbackMeals = this.getFallbackMeals();
    const meals: MealData[] = [];

    for (let day = 1; day <= days; day++) {
      const mealTypes = ["BREAKFAST", "LUNCH", "DINNER"].slice(0, mealsPerDay);
      
      mealTypes.forEach((mealType, index) => {
        const baseMeal = fallbackMeals[index % fallbackMeals.length];
        meals.push({
          ...baseMeal,
          name: `${baseMeal.name} - Day ${day}`,
          meal_type: mealType,
          day_number: day,
        });
      });
    }

    const totalCalories = meals.reduce((sum, meal) => sum + meal.calories, 0);
    const totalProtein = meals.reduce((sum, meal) => sum + meal.protein, 0);
    const totalCarbs = meals.reduce((sum, meal) => sum + meal.carbs, 0);
    const totalFat = meals.reduce((sum, meal) => sum + meal.fat, 0);

    return {
      title: `${days}-Day Personalized Menu`,
      description: "AI-generated meal plan tailored to your preferences",
      total_calories: totalCalories,
      total_protein: totalProtein,
      total_carbs: totalCarbs,
      total_fat: totalFat,
      days_count: days,
      estimated_cost: params.budget || 50,
      meals,
    };
  }

  private static generateFallbackCustomMenu(params: GenerateMenuParams) {
    const days = params.days || 7;
    const targetCalories = 2000;
    
    return {
      title: `Custom ${days}-Day Menu`,
      description: params.customRequest || "Custom meal plan based on your request",
      total_calories: targetCalories * days,
      total_protein: 150 * days,
      total_carbs: 250 * days,
      total_fat: 67 * days,
      days_count: days,
      estimated_cost: params.budget || 50,
      meals: this.generateFallbackMeals(days),
    };
  }

  private static getFallbackMeals(): MealData[] {
    return [
      {
        name: "Protein Breakfast Bowl",
        meal_type: "BREAKFAST",
        day_number: 1,
        calories: 350,
        protein: 25,
        carbs: 30,
        fat: 15,
        fiber: 8,
        prep_time_minutes: 15,
        cooking_method: "Mixed",
        instructions: "Combine eggs, oats, and fruits for a balanced breakfast",
        ingredients: [
          { name: "eggs", quantity: 2, unit: "piece", category: "protein" },
          { name: "oats", quantity: 50, unit: "g", category: "grain" },
          { name: "banana", quantity: 1, unit: "piece", category: "fruit" },
        ],
      },
      {
        name: "Balanced Lunch Plate",
        meal_type: "LUNCH",
        day_number: 1,
        calories: 450,
        protein: 35,
        carbs: 40,
        fat: 18,
        fiber: 10,
        prep_time_minutes: 25,
        cooking_method: "Grilled",
        instructions: "Grill chicken, steam vegetables, serve with quinoa",
        ingredients: [
          { name: "chicken breast", quantity: 150, unit: "g", category: "protein" },
          { name: "quinoa", quantity: 80, unit: "g", category: "grain" },
          { name: "mixed vegetables", quantity: 200, unit: "g", category: "vegetable" },
        ],
      },
      {
        name: "Light Dinner",
        meal_type: "DINNER",
        day_number: 1,
        calories: 400,
        protein: 30,
        carbs: 35,
        fat: 16,
        fiber: 7,
        prep_time_minutes: 20,
        cooking_method: "Baked",
        instructions: "Bake fish with vegetables and serve with rice",
        ingredients: [
          { name: "fish fillet", quantity: 120, unit: "g", category: "protein" },
          { name: "brown rice", quantity: 60, unit: "g", category: "grain" },
          { name: "broccoli", quantity: 150, unit: "g", category: "vegetable" },
        ],
      },
    ];
  }

  private static generateFallbackMeals(days: number): MealData[] {
    const baseMeals = this.getFallbackMeals();
    const meals: MealData[] = [];

    for (let day = 1; day <= days; day++) {
      baseMeals.forEach((meal, index) => {
        meals.push({
          ...meal,
          name: `${meal.name} - Day ${day}`,
          day_number: day,
        });
      });
    }

    return meals;
  }

  private static async saveMenuToDatabase(userId: string, menuData: any) {
    try {
      console.log("💾 Saving menu to database...");

      // Create the recommended menu
      const menu = await prisma.recommendedMenu.create({
        data: {
          user_id: userId,
          title: menuData.title,
          description: menuData.description,
          total_calories: menuData.total_calories,
          total_protein: menuData.total_protein,
          total_carbs: menuData.total_carbs,
          total_fat: menuData.total_fat,
          total_fiber: menuData.total_fiber || 0,
          days_count: menuData.days_count,
          dietary_category: menuData.dietary_category || "BALANCED",
          estimated_cost: menuData.estimated_cost,
          prep_time_minutes: menuData.prep_time_minutes || 30,
          difficulty_level: menuData.difficulty_level || 2,
          is_active: true,
        },
      });

      // Save meals
      const mealPromises = menuData.meals.map((meal: any) =>
        prisma.recommendedMeal.create({
          data: {
            menu_id: menu.menu_id,
            name: meal.name,
            meal_type: meal.meal_type,
            day_number: meal.day_number,
            calories: meal.calories,
            protein: meal.protein,
            carbs: meal.carbs,
            fat: meal.fat,
            fiber: meal.fiber || 0,
            prep_time_minutes: meal.prep_time_minutes || 30,
            cooking_method: meal.cooking_method || "Mixed",
            instructions: meal.instructions || "",
          },
        })
      );

      const savedMeals = await Promise.all(mealPromises);

      // Save ingredients for each meal
      for (let i = 0; i < savedMeals.length; i++) {
        const meal = savedMeals[i];
        const mealData = menuData.meals[i];

        if (mealData.ingredients && Array.isArray(mealData.ingredients)) {
          const ingredientPromises = mealData.ingredients.map((ingredient: any) =>
            prisma.recommendedIngredient.create({
              data: {
                meal_id: meal.meal_id,
                name: ingredient.name,
                quantity: ingredient.quantity,
                unit: ingredient.unit,
                category: ingredient.category || "Other",
                estimated_cost: ingredient.estimated_cost || 0,
              },
            })
          );

          await Promise.all(ingredientPromises);
        }
      }

      // Return complete menu with meals and ingredients
      const completeMenu = await prisma.recommendedMenu.findUnique({
        where: { menu_id: menu.menu_id },
        include: {
          meals: {
            include: {
              ingredients: true,
            },
            orderBy: [{ day_number: "asc" }, { meal_type: "asc" }],
          },
        },
      });

      console.log("✅ Menu saved to database successfully");
      return completeMenu;
    } catch (error) {
      console.error("💥 Error saving menu to database:", error);
      throw error;
    }
  }

  private static calculateDefaultCalories(questionnaire: any): number {
    const weight = questionnaire.weight_kg || 70;
    const height = questionnaire.height_cm || 170;
    const age = questionnaire.age || 30;
    const gender = questionnaire.gender || "male";

    // Harris-Benedict equation
    let bmr;
    if (gender.toLowerCase() === "male") {
      bmr = 88.362 + (13.397 * weight) + (4.799 * height) - (5.677 * age);
    } else {
      bmr = 447.593 + (9.247 * weight) + (3.098 * height) - (4.33 * age);
    }

    // Activity multiplier
    const activityMultipliers = {
      NONE: 1.2,
      LIGHT: 1.375,
      MODERATE: 1.55,
      HIGH: 1.725,
    };

    const activityLevel = questionnaire.physical_activity_level || "MODERATE";
    const tdee = bmr * (activityMultipliers[activityLevel] || 1.55);

    // Adjust for goals
    let targetCalories = tdee;
    if (questionnaire.main_goal === "WEIGHT_LOSS") {
      targetCalories -= 500;
    } else if (questionnaire.main_goal === "WEIGHT_GAIN") {
      targetCalories += 300;
    }

    return Math.round(Math.max(1200, Math.min(4000, targetCalories)));
  }

  private static getMealsPerDayCount(mealsPerDay: string): number {
    switch (mealsPerDay) {
      case "2_main":
        return 2;
      case "3_main":
        return 3;
      case "3_plus_2_snacks":
        return 5;
      case "2_plus_1_intermediate":
        return 3;
      default:
        return 3;
    }
  }

  static async replaceMeal(
    userId: string,
    menuId: string,
    mealId: string,
    preferences: any
  ) {
    try {
      console.log("🔄 Replacing meal in menu:", { menuId, mealId });

      // Get the meal to replace
      const meal = await prisma.recommendedMeal.findFirst({
        where: {
          meal_id: mealId,
          menu: { user_id: userId },
        },
        include: {
          ingredients: true,
        },
      });

      if (!meal) {
        throw new Error("Meal not found");
      }

      // Generate replacement meal
      const replacementMeal = await this.generateReplacementMeal(meal, preferences);

      // Update the meal
      const updatedMeal = await prisma.recommendedMeal.update({
        where: { meal_id: mealId },
        data: {
          name: replacementMeal.name,
          calories: replacementMeal.calories,
          protein: replacementMeal.protein,
          carbs: replacementMeal.carbs,
          fat: replacementMeal.fat,
          fiber: replacementMeal.fiber,
          prep_time_minutes: replacementMeal.prep_time_minutes,
          cooking_method: replacementMeal.cooking_method,
          instructions: replacementMeal.instructions,
        },
      });

      return updatedMeal;
    } catch (error) {
      console.error("💥 Error replacing meal:", error);
      throw error;
    }
  }

  private static async generateReplacementMeal(meal: any, preferences: any) {
    // Simple replacement logic for fallback
    const replacements = [
      {
        name: "Grilled Chicken Salad",
        calories: 380,
        protein: 35,
        carbs: 15,
        fat: 18,
        fiber: 8,
        prep_time_minutes: 20,
        cooking_method: "Grilled",
        instructions: "Grill chicken, prepare fresh salad, combine with dressing",
      },
      {
        name: "Quinoa Power Bowl",
        calories: 420,
        protein: 18,
        carbs: 55,
        fat: 15,
        fiber: 12,
        prep_time_minutes: 25,
        cooking_method: "Boiled",
        instructions: "Cook quinoa, add vegetables and protein, dress with tahini",
      },
      {
        name: "Baked Salmon with Vegetables",
        calories: 450,
        protein: 32,
        carbs: 25,
        fat: 22,
        fiber: 6,
        prep_time_minutes: 30,
        cooking_method: "Baked",
        instructions: "Bake salmon with seasonal vegetables and herbs",
      },
    ];

    return replacements[Math.floor(Math.random() * replacements.length)];
  }

  static async markMealAsFavorite(
    userId: string,
    menuId: string,
    mealId: string,
    isFavorite: boolean
  ) {
    // Implementation for marking meals as favorite
    console.log("❤️ Marking meal as favorite:", { mealId, isFavorite });
    // This would typically update a user preference table
  }

  static async giveMealFeedback(
    userId: string,
    menuId: string,
    mealId: string,
    liked: boolean
  ) {
    // Implementation for meal feedback
    console.log("👍 Recording meal feedback:", { mealId, liked });
    // This would typically save feedback to improve future recommendations
  }

  static async generateShoppingList(userId: string, menuId: string) {
    try {
      console.log("🛒 Generating shopping list for menu:", menuId);

      const menu = await prisma.recommendedMenu.findFirst({
        where: {
          menu_id: menuId,
          user_id: userId,
        },
        include: {
          meals: {
            include: {
              ingredients: true,
            },
          },
        },
      });

      if (!menu) {
        throw new Error("Menu not found");
      }

      // Aggregate ingredients
      const ingredientMap = new Map<string, any>();

      menu.meals.forEach((meal) => {
        meal.ingredients.forEach((ingredient) => {
          const key = `${ingredient.name}_${ingredient.unit}`;
          if (ingredientMap.has(key)) {
            const existing = ingredientMap.get(key);
            existing.quantity += ingredient.quantity;
            existing.estimated_cost += ingredient.estimated_cost || 0;
          } else {
            ingredientMap.set(key, {
              name: ingredient.name,
              quantity: ingredient.quantity,
              unit: ingredient.unit,
              category: ingredient.category || "Other",
              estimated_cost: ingredient.estimated_cost || 0,
            });
          }
        });
      });

      const shoppingList = Array.from(ingredientMap.values());
      const totalCost = shoppingList.reduce((sum, item) => sum + item.estimated_cost, 0);

      return {
        menu_id: menuId,
        items: shoppingList,
        total_estimated_cost: totalCost,
        generated_at: new Date().toISOString(),
      };
    } catch (error) {
      console.error("💥 Error generating shopping list:", error);
      throw error;
    }
  }
}