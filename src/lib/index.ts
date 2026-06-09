// Lib barrel exports
export { cn } from './utils';
export { activityLogger, logActivity } from './activityLogger';
export { 
  generateContractPDF, 
  replacePlaceholders, 
  processConditionalSections,
  generateSignedContractPDF,
  sanitizeContractHtml,
  stripUnreplacedPlaceholders,
  stripRemainingSectionMarkers,
} from './pdfGenerator';
