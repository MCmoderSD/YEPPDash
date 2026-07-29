export interface Quote {

  // The quote's position in the channel's list, numbered from 1. Moving or deleting a quote
  // renumbers the ones around it, so this is not a stable identifier.
  id: number;
  quote: string;
  timestamp: string;
}
