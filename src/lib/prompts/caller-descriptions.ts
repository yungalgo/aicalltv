/**
 * Random caller character descriptions for image generation
 * These are used to create variety in the prank caller's appearance
 */

export const CALLER_DESCRIPTIONS = [
  // Professional types
  "a middle-aged person wearing glasses and a button-up shirt, looking professional",
  "someone in a suit and tie with slicked-back hair",
  "a person wearing a headset like a call center employee",
  "an older gentleman with gray hair and a warm smile",
  "a young professional with stylish glasses and neat hair",
  
  // Casual types
  "a person in a hoodie with messy hair, looking relaxed",
  "someone wearing a baseball cap backwards with a friendly expression",
  "a laid-back person in a t-shirt with headphones around their neck",
  "someone with colorful dyed hair and casual clothes",
  "a person with a beanie and cozy sweater",
  
  // Quirky types
  "an eccentric person with wild curly hair and big earrings",
  "someone wearing vintage clothes with thick-rimmed glasses",
  "a person with a bowtie and suspenders looking enthusiastic",
  "someone with a mustache and interesting hat",
  "a character with funky sunglasses pushed up on their head",
  
  // Friendly types
  "a cheerful person with a big smile and friendly eyes",
  "someone with a warm expression and casual attire",
  "a person who looks like your friendly neighbor",
  "someone with laugh lines and an approachable demeanor",
  "a kind-looking person with gentle features",
  
  // Unique types
  "a person with interesting tattoos visible on their arms",
  "someone with a unique hairstyle and expressive face",
  "a character with distinctive jewelry and accessories",
  "a person with freckles and an animated expression",
  "someone with a distinctive beard or facial hair style",
];

/**
 * Get a random caller description
 */
export function getRandomCallerDescription(): string {
  const index = Math.floor(Math.random() * CALLER_DESCRIPTIONS.length);
  return CALLER_DESCRIPTIONS[index];
}

