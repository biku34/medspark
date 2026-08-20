/**
 * Demo customer addresses.
 *
 * Lives in its own module so both the main seed and the care-plan seed can use
 * it without importing each other in a circle.
 */

export const CUSTOMER_HOMES: Record<
  string,
  { address: string; locality: string; city: string; lat: number; lng: number }
> = {
  usr_aarav: {
    address: "B-402, Shreenath Residency, Sector 11, Gandhinagar",
    locality: "Sector 11",
    city: "Gandhinagar",
    lat: 23.227,
    lng: 72.642,
  },
  usr_priya: {
    address: "Flat 9, Sapphire Apartments, Navrangpura, Ahmedabad",
    locality: "Navrangpura",
    city: "Ahmedabad",
    lat: 23.038,
    lng: 72.56,
  },
  usr_rohan: {
    address: "C-14, Suman Tower Road, Sector 11, Gandhinagar",
    locality: "Sector 11",
    city: "Gandhinagar",
    lat: 23.2255,
    lng: 72.6402,
  },
};
