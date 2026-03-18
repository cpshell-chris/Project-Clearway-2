export function getDefaultCultureProfile() {
  return {
    name: "Cardinal Plaza Shell",
    location: "8334 Old Keene Mill Rd, Springfield, VA 22152",
    phone: "703-451-8373",
    email: "service@cardinalplazashell.com",
    voice: "Calm, educational, and warm. Never clinical or robotic. Respect the customer's intelligence and autonomy.",
    dviChecklist: [
      { name: 'Brakes & Rotors',       photoRequired: true,        note: 'Measure pad thickness and rotor condition front and rear' },
      { name: 'Tires (all 4 corners)',  photoRequired: true,        note: 'Measure tread depth at each corner; note any uneven wear' },
      { name: 'Fluids',                 photoRequired: false,       note: 'Check color and level: engine oil, coolant, brake fluid, power steering, transmission' },
      { name: 'Engine Air Filter',      photoRequired: 'if-dirty',  note: 'Compare to new filter if possible' },
      { name: 'Cabin Air Filter',       photoRequired: 'if-dirty',  note: 'Note condition and mileage since last replacement' },
      { name: 'Battery',                photoRequired: false,       note: 'Test CCA and record result' },
      { name: 'Wiper Blades',           photoRequired: false,       note: 'Check condition; note streaking or fraying' },
      { name: 'Belts & Hoses',          photoRequired: false,       note: 'Check for cracking, fraying, or softness' },
    ]
  };
}
