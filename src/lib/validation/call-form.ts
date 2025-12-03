import { VIDEO_STYLES } from "~/lib/constants/video-styles";

export interface CallFormData {
  recipientName?: string;
  phoneNumber?: string;
  targetGender?: "male" | "female" | "prefer_not_to_say" | "other";
  targetGenderCustom?: string;
  targetAgeRange?: "" | "18-25" | "26-35" | "36-45" | "46-55" | "56+";
  targetPhysicalDescription?: string;
  targetCity?: string;
  targetHobby?: string;
  targetProfession?: string;
  interestingPiece?: string;
  ragebaitTrigger?: string;
  videoStyle?: string;
  uploadedImageUrl?: string;
  uploadedImageS3Key?: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  normalizedData: Partial<CallFormData>;
}

/**
 * Validates and normalizes a US phone number
 * Accepts formats like: +1 555-123-4567, (555) 123-4567, 555-123-4567, 5551234567
 * Always returns in format: +1XXXXXXXXXX (11 digits total)
 */
function validateAndNormalizePhoneNumber(phone: string): { valid: boolean; normalized?: string; error?: string } {
  if (!phone || typeof phone !== "string") {
    return { valid: false, error: "Phone number is required" };
  }

  // Remove all non-digit characters except +
  const cleaned = phone.trim();
  
  // Remove common formatting characters
  let digits = cleaned.replace(/[^\d+]/g, "");
  
  // Handle +1 prefix
  if (digits.startsWith("+1")) {
    digits = digits.substring(2);
  } else if (digits.startsWith("1") && digits.length === 11) {
    digits = digits.substring(1);
  }
  
  // Must be exactly 10 digits for US number
  if (digits.length !== 10) {
    return { 
      valid: false, 
      error: `Phone number must be 10 digits. Got ${digits.length} digits. Please provide a US phone number in format: +1 (555) 123-4567` 
    };
  }
  
  // Check if it's a valid US area code (starts with 2-9)
  const areaCode = digits.substring(0, 3);
  if (areaCode[0] === "0" || areaCode[0] === "1") {
    return { 
      valid: false, 
      error: "Invalid US area code. Area code must start with 2-9." 
    };
  }
  
  // Check exchange code (4th digit must be 2-9)
  const exchangeCode = digits.substring(3, 6);
  if (exchangeCode[0] === "0" || exchangeCode[0] === "1") {
    return { 
      valid: false, 
      error: "Invalid US exchange code. Exchange code must start with 2-9." 
    };
  }
  
  // Return normalized format: +1XXXXXXXXXX
  return { valid: true, normalized: `+1${digits}` };
}

/**
 * Validates recipient name
 */
function validateRecipientName(name: string | undefined): { valid: boolean; normalized?: string; error?: string } {
  if (!name || typeof name !== "string") {
    return { valid: false, error: "Recipient name is required" };
  }
  
  const trimmed = name.trim();
  
  if (trimmed.length < 2) {
    return { valid: false, error: "Recipient name must be at least 2 characters" };
  }
  
  if (trimmed.length > 100) {
    return { valid: false, error: "Recipient name must be 100 characters or less" };
  }
  
  // Check for valid characters (letters, spaces, hyphens, apostrophes)
  if (!/^[a-zA-Z\s'-]+$/.test(trimmed)) {
    return { valid: false, error: "Recipient name can only contain letters, spaces, hyphens, and apostrophes" };
  }
  
  return { valid: true, normalized: trimmed };
}

/**
 * Validates gender field
 */
function validateGender(
  gender: string | undefined,
  customGender?: string
): { valid: boolean; normalized?: CallFormData["targetGender"]; error?: string } {
  if (!gender || !gender.trim()) {
    return { valid: false, error: "Gender is required" };
  }
  
  const normalized = gender.toLowerCase().trim();
  const validGenders: CallFormData["targetGender"][] = ["male", "female", "prefer_not_to_say", "other"];
  
  if (!validGenders.includes(normalized as CallFormData["targetGender"])) {
    return { 
      valid: false, 
      error: `Invalid gender. Must be one of: ${validGenders.join(", ")}` 
    };
  }
  
  if (normalized === "other" && (!customGender || !customGender.trim())) {
    return { 
      valid: false, 
      error: "Custom gender is required when gender is 'other'" 
    };
  }
  
  return { valid: true, normalized: normalized as CallFormData["targetGender"] };
}

/**
 * Validates age range
 */
function validateAgeRange(ageRange: string | undefined): { valid: boolean; normalized?: CallFormData["targetAgeRange"]; error?: string } {
  if (!ageRange || !ageRange.trim()) {
    return { valid: false, error: "Age range is required" };
  }
  
  const validRanges: CallFormData["targetAgeRange"][] = ["18-25", "26-35", "36-45", "46-55", "56+"];
  
  if (!validRanges.includes(ageRange as CallFormData["targetAgeRange"])) {
    return { 
      valid: false, 
      error: `Invalid age range. Must be one of: ${validRanges.join(", ")}` 
    };
  }
  
  return { valid: true, normalized: ageRange as CallFormData["targetAgeRange"] };
}

/**
 * Validates video style (can be from list or custom)
 */
function validateVideoStyle(style: string | undefined): { valid: boolean; normalized?: string; error?: string } {
  if (!style || !style.trim()) {
    return { valid: false, error: "Video style is required" };
  }
  
  const trimmed = style.trim();
  
  // Normalize: lowercase and replace spaces with hyphens
  const normalized = trimmed.toLowerCase().replace(/\s+/g, "-");
  
  // If it's in the list, use normalized version
  if (VIDEO_STYLES.includes(normalized as typeof VIDEO_STYLES[number])) {
    return { valid: true, normalized };
  }
  
  // Otherwise, allow custom style (but validate length)
  if (trimmed.length < 2) {
    return { valid: false, error: "Video style must be at least 2 characters" };
  }
  
  if (trimmed.length > 50) {
    return { valid: false, error: "Video style must be 50 characters or less" };
  }
  
  return { valid: true, normalized: trimmed.toLowerCase() };
}

/**
 * Validates text fields (interestingPiece, ragebaitTrigger, etc.)
 */
function validateTextField(
  value: string | undefined,
  fieldName: string,
  maxLength: number,
  required: boolean = false
): { valid: boolean; normalized?: string; error?: string } {
  if (!value) {
    if (required) {
      return { valid: false, error: `${fieldName} is required` };
    }
    return { valid: true }; // Optional field
  }
  
  if (typeof value !== "string") {
    return { valid: false, error: `${fieldName} must be a string` };
  }
  
  const trimmed = value.trim();
  
  if (trimmed.length > maxLength) {
    return { valid: false, error: `${fieldName} must be ${maxLength} characters or less` };
  }
  
  return { valid: true, normalized: trimmed };
}

/**
 * Comprehensive validation function for call form data
 */
export function validateCallFormData(data: Partial<CallFormData>): ValidationResult {
  const errors: ValidationError[] = [];
  const normalizedData: Partial<CallFormData> = {};

  // Validate recipient name (required)
  const nameResult = validateRecipientName(data.recipientName);
  if (!nameResult.valid) {
    errors.push({ field: "recipientName", message: nameResult.error! });
  } else if (nameResult.normalized) {
    normalizedData.recipientName = nameResult.normalized;
  }

  // Validate phone number (required)
  const phoneResult = validateAndNormalizePhoneNumber(data.phoneNumber || "");
  if (!phoneResult.valid) {
    errors.push({ field: "phoneNumber", message: phoneResult.error! });
  } else if (phoneResult.normalized) {
    normalizedData.phoneNumber = phoneResult.normalized;
  }

  // Validate gender (required)
  const genderResult = validateGender(data.targetGender, data.targetGenderCustom);
  if (!genderResult.valid) {
    errors.push({ field: "targetGender", message: genderResult.error! });
  } else if (genderResult.normalized) {
    normalizedData.targetGender = genderResult.normalized;
    if (genderResult.normalized === "other" && data.targetGenderCustom) {
      const customResult = validateTextField(data.targetGenderCustom, "Custom gender", 50, true);
      if (!customResult.valid) {
        errors.push({ field: "targetGenderCustom", message: customResult.error! });
      } else if (customResult.normalized) {
        normalizedData.targetGenderCustom = customResult.normalized;
      }
    }
  } else {
    errors.push({ field: "targetGender", message: "Gender is required" });
  }

  // Validate age range (required)
  const ageResult = validateAgeRange(data.targetAgeRange);
  if (!ageResult.valid) {
    errors.push({ field: "targetAgeRange", message: ageResult.error! });
  } else if (ageResult.normalized) {
    normalizedData.targetAgeRange = ageResult.normalized;
  } else {
    errors.push({ field: "targetAgeRange", message: "Age range is required" });
  }

  // Validate city (required)
  const cityResult = validateTextField(data.targetCity, "City/Area", 100, true);
  if (!cityResult.valid) {
    errors.push({ field: "targetCity", message: cityResult.error! });
  } else if (cityResult.normalized) {
    normalizedData.targetCity = cityResult.normalized;
  }

  // Validate hobby (required)
  const hobbyResult = validateTextField(data.targetHobby, "Hobby", 100, true);
  if (!hobbyResult.valid) {
    errors.push({ field: "targetHobby", message: hobbyResult.error! });
  } else if (hobbyResult.normalized) {
    normalizedData.targetHobby = hobbyResult.normalized;
  }

  // Validate profession (required)
  const professionResult = validateTextField(data.targetProfession, "Profession", 100, true);
  if (!professionResult.valid) {
    errors.push({ field: "targetProfession", message: professionResult.error! });
  } else if (professionResult.normalized) {
    normalizedData.targetProfession = professionResult.normalized;
  }

  // Validate physical description (required if no image uploaded)
  const hasImage = !!(data.uploadedImageUrl || data.uploadedImageS3Key);
  if (!hasImage) {
    const physicalResult = validateTextField(data.targetPhysicalDescription, "Physical Description", 500, true);
    if (!physicalResult.valid) {
      errors.push({ field: "targetPhysicalDescription", message: physicalResult.error! });
    } else if (physicalResult.normalized) {
      normalizedData.targetPhysicalDescription = physicalResult.normalized;
    }
  } else {
    // Optional if image uploaded
    const physicalResult = validateTextField(data.targetPhysicalDescription, "Physical Description", 500, false);
    if (!physicalResult.valid) {
      errors.push({ field: "targetPhysicalDescription", message: physicalResult.error! });
    } else if (physicalResult.normalized) {
      normalizedData.targetPhysicalDescription = physicalResult.normalized;
    }
  }

  // Validate video style (required)
  const styleResult = validateVideoStyle(data.videoStyle);
  if (!styleResult.valid) {
    errors.push({ field: "videoStyle", message: styleResult.error! });
  } else if (styleResult.normalized) {
    normalizedData.videoStyle = styleResult.normalized;
  }

  // Validate interesting piece (required)
  const interestingResult = validateTextField(data.interestingPiece, "Interesting piece", 500, true);
  if (!interestingResult.valid) {
    errors.push({ field: "interestingPiece", message: interestingResult.error! });
  } else if (interestingResult.normalized) {
    normalizedData.interestingPiece = interestingResult.normalized;
  }

  // Validate ragebait trigger (required)
  const ragebaitResult = validateTextField(data.ragebaitTrigger, "Ragebait trigger", 500, true);
  if (!ragebaitResult.valid) {
    errors.push({ field: "ragebaitTrigger", message: ragebaitResult.error! });
  } else if (ragebaitResult.normalized) {
    normalizedData.ragebaitTrigger = ragebaitResult.normalized;
  }

  return {
    isValid: errors.length === 0,
    errors,
    normalizedData,
  };
}

