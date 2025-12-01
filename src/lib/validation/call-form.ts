import { VIDEO_STYLES } from "~/lib/constants/video-styles";

export interface CallFormData {
  recipientName?: string;
  phoneNumber?: string;
  targetGender?: "male" | "female" | "prefer_not_to_say" | "other";
  targetGenderCustom?: string;
  targetAgeRange?: "" | "18-25" | "26-35" | "36-45" | "46-55" | "56+";
  interestingPiece?: string;
  videoStyle?: string;
  anythingElse?: string;
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
  if (!gender) {
    return { valid: true }; // Optional field
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
  if (!ageRange) {
    return { valid: true }; // Optional field
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
 * Validates video style
 */
function validateVideoStyle(style: string | undefined): { valid: boolean; normalized?: string; error?: string } {
  if (!style) {
    return { valid: false, error: "Video style is required" };
  }
  
  // Normalize: lowercase and replace spaces with hyphens
  const normalized = style.toLowerCase().trim().replace(/\s+/g, "-");
  
  if (!VIDEO_STYLES.includes(normalized as typeof VIDEO_STYLES[number])) {
    return { 
      valid: false, 
      error: `Invalid video style. Must be one of: ${VIDEO_STYLES.join(", ")}` 
    };
  }
  
  return { valid: true, normalized };
}

/**
 * Validates text fields (interestingPiece, anythingElse)
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

  // Validate gender (optional)
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
  }

  // Validate age range (optional)
  const ageResult = validateAgeRange(data.targetAgeRange);
  if (!ageResult.valid) {
    errors.push({ field: "targetAgeRange", message: ageResult.error! });
  } else if (ageResult.normalized) {
    normalizedData.targetAgeRange = ageResult.normalized;
  }

  // Validate video style (required)
  const styleResult = validateVideoStyle(data.videoStyle);
  if (!styleResult.valid) {
    errors.push({ field: "videoStyle", message: styleResult.error! });
  } else if (styleResult.normalized) {
    normalizedData.videoStyle = styleResult.normalized;
  }

  // Validate interesting piece (optional)
  const interestingResult = validateTextField(data.interestingPiece, "Interesting piece", 500);
  if (!interestingResult.valid) {
    errors.push({ field: "interestingPiece", message: interestingResult.error! });
  } else if (interestingResult.normalized) {
    normalizedData.interestingPiece = interestingResult.normalized;
  }

  // Validate anything else (optional)
  const anythingElseResult = validateTextField(data.anythingElse, "Anything else", 1000);
  if (!anythingElseResult.valid) {
    errors.push({ field: "anythingElse", message: anythingElseResult.error! });
  } else if (anythingElseResult.normalized) {
    normalizedData.anythingElse = anythingElseResult.normalized;
  }

  return {
    isValid: errors.length === 0,
    errors,
    normalizedData,
  };
}

