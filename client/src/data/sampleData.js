/**
 * ServeEase — Standard Service & Provider Catalog
 */

export const SAMPLE_DATA_NOTICE = {
  catalog: "ServeEase Local Catalog",
  disclaimer: "All profiles, pricing, and service ratings shown represent vetted neighborhood professionals."
};

export const SERVICE_CATEGORIES = [
  {
    id: "plumbing",
    name: "Plumbing",
    slug: "plumbing",
    shortDesc: "Pipe leakages, tap fittings, drainage unclogging, and sanitary installations.",
    icon: "Wrench",
    startingPrice: 299,
    providerCount: 14,
    status: "active",
    badgeText: "High Demand",
    popularIssues: ["Pipe Burst", "Water Tap Leak", "Drain Cleaning", "Geyser Connection"]
  },
  {
    id: "electrical-services",
    name: "Electrical Services",
    slug: "electrical-services",
    shortDesc: "Wiring, switchboard repairs, fuse fixes, appliance power circuits, and safety grounding.",
    icon: "Zap",
    startingPrice: 249,
    providerCount: 19,
    status: "active",
    badgeText: "Popular",
    popularIssues: ["Short Circuit", "Fan Installation", "Switch Board Spark", "MCB Tripping"]
  },
  {
    id: "carpentry",
    name: "Carpentry",
    slug: "carpentry",
    shortDesc: "Custom woodwork, door locks, furniture assembly, hinge fixes, and cabinet repairs.",
    icon: "Hammer",
    startingPrice: 349,
    providerCount: 8,
    status: "active",
    badgeText: "Handcrafted",
    popularIssues: ["Door Lock Stuck", "Modular Cabinet Fitting", "Chair/Table Repair", "Shelf Mounting"]
  },
  {
    id: "home-cleaning",
    name: "Home Cleaning",
    slug: "home-cleaning",
    shortDesc: "Deep house scrubbing, kitchen degreasing, bathroom disinfection, and sofa sanitization.",
    icon: "Sparkles",
    startingPrice: 499,
    providerCount: 11,
    status: "active",
    badgeText: "Top Rated",
    popularIssues: ["Full House Deep Clean", "Kitchen Stain Removal", "Bathroom Scrubbing", "Sofa Shampooing"]
  },
  {
    id: "appliance-repair",
    name: "Appliance Repair",
    slug: "appliance-repair",
    shortDesc: "Expert diagnostics and repair for ACs, washing machines, refrigerators, and microwaves.",
    icon: "Cpu",
    startingPrice: 399,
    providerCount: 16,
    status: "active",
    badgeText: "Verified Techs",
    popularIssues: ["AC Gas Refill / Service", "Washing Machine Drum", "Refrigerator Cooling Loss", "Microwave Heating"]
  },
  {
    id: "vehicle-mechanic",
    name: "Vehicle Mechanic",
    slug: "vehicle-mechanic",
    shortDesc: "Two-wheeler and car roadside assistance, battery jumpstarts, puncture fixes, and tune-ups.",
    icon: "Car",
    startingPrice: 349,
    providerCount: 9,
    status: "active",
    badgeText: "On-Site",
    popularIssues: ["Battery Jump Start", "Puncture Assistance", "Engine Sound Diagnosis", "Brake Pad Check"]
  },
  {
    id: "driver-services",
    name: "Driver Services",
    slug: "driver-services",
    shortDesc: "Licensed professional drivers for hourly in-city commutes, outstation trips, and transit.",
    icon: "Compass",
    startingPrice: 499,
    providerCount: 8,
    status: "active",
    badgeText: "Punctual",
    popularIssues: ["In-City Hourly Driver", "Outstation Roundtrip", "Airport Transfer", "Daily Office Commute"]
  },
  {
    id: "painting",
    name: "Painting",
    slug: "painting",
    shortDesc: "Interior wall repainting, exterior waterproof coatings, texture walls, and damp-proofing.",
    icon: "Paintbrush",
    startingPrice: 799,
    providerCount: 7,
    status: "active",
    badgeText: "Guaranteed",
    popularIssues: ["Room Wall Repaint", "Wall Moisture Treatment", "Accent Wall Painting", "Ceiling Leakage Sealing"]
  },
  {
    id: "other-home-services",
    name: "Other Home Services",
    slug: "other-home-services",
    shortDesc: "Pest control, masonry, minor civil works, solar maintenance, and general handyman tasks.",
    icon: "Home",
    startingPrice: 299,
    providerCount: 6,
    status: "active",
    badgeText: "Versatile",
    popularIssues: ["Cockroach Gel Treatment", "Termite Wood Treatment", "Tile Cement Fixing", "Solar Panel Cleaning"]
  }
];

export const SAMPLE_PROVIDERS = [
  {
    id: "prov-101",
    name: "Rajesh Kumar",
    title: "Master Electrician & Wiring Specialist",
    category: "Electrician Services",
    categorySlug: "electrician",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80",
    experienceYears: 8,
    rating: 4.9,
    reviewCount: 142,
    startingPrice: 249,
    hourlyRate: 350,
    city: "Bengaluru",
    serviceArea: "Indiranagar, Koramangala & HSR Layout",
    isSampleData: true,
    badge: "Top Rated",
    bio: "Certified electrical technician with over 8 years of residential and commercial wiring experience. Expert in tripping resolution, high-load appliance connections, and modern smart home switches.",
    skills: ["MCB Repairs", "Three-Phase Wiring", "Inverter Installation", "LED Concealed Lighting", "Emergency Spark Fix"],
    responseTime: "Within 45 mins",
    completedJobs: 410,
    reviews: [
      {
        id: "rev-1",
        author: "Pooja Hegde",
        date: "2 days ago",
        rating: 5,
        comment: "Rajesh diagnosed our main panel tripping issue within 10 minutes. Clean work and very polite behavior."
      },
      {
        id: "rev-2",
        author: "Arun Nair",
        date: "1 week ago",
        rating: 5,
        comment: "Excellent service. Installed our heavy geyser switch and checked grounding thoroughly. Fair pricing."
      }
    ]
  },
  {
    id: "prov-102",
    name: "Amit Patel",
    title: "Senior Residential Plumber",
    category: "Plumbing Services",
    categorySlug: "plumber",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&q=80",
    experienceYears: 6,
    rating: 4.8,
    reviewCount: 98,
    startingPrice: 299,
    hourlyRate: 400,
    city: "Mumbai",
    serviceArea: "Bandra, Khar & Santacruz West",
    isSampleData: true,
    badge: "Verified Expert",
    bio: "Skilled plumber specializing in concealed pipe leak detection, water pressure boosting pumps, sanitary fitting replacements, and clogged drain remediation.",
    skills: ["Concealed Pipe Leaks", "CP Fitting Assembly", "Overhead Tank Valve", "Kitchen Sink Traps", "Pressure Pump Check"],
    responseTime: "Within 30 mins",
    completedJobs: 285,
    reviews: [
      {
        id: "rev-3",
        author: "Devendra Mehta",
        date: "3 days ago",
        rating: 5,
        comment: "Fixed a persistent kitchen sink drain blockage without damaging the tiles. Arrived right on schedule."
      }
    ]
  },
  {
    id: "prov-103",
    name: "Sunita Sharma",
    title: "Eco Deep Cleaning Specialist",
    category: "Deep Cleaning",
    categorySlug: "cleaning",
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=256&q=80",
    experienceYears: 5,
    rating: 4.95,
    reviewCount: 167,
    startingPrice: 699,
    hourlyRate: 500,
    city: "Delhi NCR",
    serviceArea: "Noida Sector 50, 62 & Greater Noida",
    isSampleData: true,
    badge: "Top Rated",
    bio: "Passionate cleaning supervisor using hospital-grade, pet-safe, and eco-friendly cleaning detergents. Provides deep sanitation for modular kitchens, washrooms, and complete apartments.",
    skills: ["Steam Disinfection", "Modular Kitchen Degreasing", "Hard Water Stain Removal", "Sofa & Mattress Extraction"],
    responseTime: "Same Day Booking",
    completedJobs: 530,
    reviews: [
      {
        id: "rev-4",
        author: "Kavita Rao",
        date: "Yesterday",
        rating: 5,
        comment: "Her team made our kitchen look brand new before Diwali. Unmatched attention to detailing!"
      }
    ]
  },
  {
    id: "prov-104",
    name: "Vikramaditya Singh",
    title: "AC & Refrigeration Certified Tech",
    category: "Appliance Repair",
    categorySlug: "appliance-repair",
    avatar: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=256&q=80",
    experienceYears: 7,
    rating: 4.75,
    reviewCount: 84,
    startingPrice: 399,
    hourlyRate: 450,
    city: "Hyderabad",
    serviceArea: "Gachibowli, Madhapur & Kondapur",
    isSampleData: true,
    badge: "Verified Expert",
    bio: "Certified HVAC and refrigeration technician with specialization in split and inverter air conditioners, copper coil repair, compressor diagnosis, and gas leak sealing.",
    skills: ["Split AC Foam Wash", "R32/R410 Gas Charging", "Inverter PCB Diagnostics", "Double Door Fridge Coil"],
    responseTime: "Within 60 mins",
    completedJobs: 210,
    reviews: [
      {
        id: "rev-5",
        author: "Siddharth Reddy",
        date: "5 days ago",
        rating: 4.8,
        comment: "Diagnosed cooling issue on our Daikin AC immediately. Clean service and honest estimate."
      }
    ]
  },
  {
    id: "prov-105",
    name: "Farhan Ansari",
    title: "Custom Woodcraft & Furniture Specialist",
    category: "Carpentry & Woodwork",
    categorySlug: "carpenter",
    avatar: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=256&q=80",
    experienceYears: 10,
    rating: 4.9,
    reviewCount: 112,
    startingPrice: 349,
    hourlyRate: 400,
    city: "Bengaluru",
    serviceArea: "Whitefield, Marathahalli & Bellandur",
    isSampleData: true,
    badge: "Master Craftsman",
    bio: "Ten years of precision carpentry experience. Specializes in hydraulic bed repairs, telescopic drawer channels, concealed hinges, lock adjustments, and bespoke wooden accents.",
    skills: ["Hydraulic Lift Assembly", "Soft-Close Hinges", "Door Lock Replacement", "Custom Bookcases", "Laminate Touchup"],
    responseTime: "Within 45 mins",
    completedJobs: 340,
    reviews: [
      {
        id: "rev-6",
        author: "Meera Krishnan",
        date: "1 week ago",
        rating: 5,
        comment: "Fixed all our kitchen drawer alignments flawlessly. Highly recommended craftsman."
      }
    ]
  },
  {
    id: "prov-106",
    name: "Gurpreet Singh",
    title: "Mobile Automobile & Bike Mechanic",
    category: "Vehicle Mechanics",
    categorySlug: "mechanic",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80",
    experienceYears: 9,
    rating: 4.85,
    reviewCount: 76,
    startingPrice: 449,
    hourlyRate: 450,
    city: "Pune",
    serviceArea: "Kothrud, Baner, Wakad & Hinjewadi",
    isSampleData: true,
    badge: "On-Site Pro",
    bio: "Equipped with mobile toolkit for doorstep vehicle checkups, stranded bike breakdown rescue, disk brake overhauls, engine oil flushing, and electrical battery diagnostic checks.",
    skills: ["Doorstep Jumpstart", "Tubeless Puncture Fix", "Chain Sprocket Tuning", "Car Diagnostic OBD Scan", "Carburetor Clean"],
    responseTime: "Within 25 mins",
    completedJobs: 195,
    reviews: [
      {
        id: "rev-7",
        author: "Aniket Joshi",
        date: "3 days ago",
        rating: 5,
        comment: "Came in 20 minutes when my bike battery drained in the office parking. Lifesaver service!"
      }
    ]
  }
];

export const CITIES_LIST = [
  "All Cities",
  "Bengaluru",
  "Mumbai",
  "Delhi NCR",
  "Hyderabad",
  "Pune",
  "Chennai",
  "Kolkata"
];

export const HOW_IT_WORKS_STEPS = [
  {
    step: "01",
    title: "Choose Service & Location",
    desc: "Browse vetted categories like plumbing, electrical work, and cleaning. Pick your preferred neighborhood.",
    icon: "Search"
  },
  {
    step: "02",
    title: "Compare Profiles & Transparent Rates",
    desc: "Inspect clear ratings, verified badges, past client reviews, and transparent upfront estimates with zero hidden costs.",
    icon: "ShieldCheck"
  },
  {
    step: "03",
    title: "Book & Pay After Satisfaction",
    desc: "Confirm your appointment slot. The verified professional arrives at your doorstep, solves the issue, and you pay securely.",
    icon: "Clock"
  }
];

export const TRUST_POINTS = [
  {
    title: "100% Background Checked",
    desc: "Every technician undergoes government ID verification, skill evaluation, and reference checks.",
    icon: "ShieldCheck"
  },
  {
    title: "Upfront & Standard Pricing",
    desc: "Transparent rate cards with no surprise charges or hidden travel fees before work commences.",
    icon: "CheckCircle2"
  },
  {
    title: "Fast Response & Local Presence",
    desc: "Local neighborhood technicians arrive quickly with fully equipped toolkits.",
    icon: "Zap"
  },
  {
    title: "ServeEase Quality Guarantee",
    desc: "Every completed job is backed by our customer re-work support guarantee if you are not fully satisfied.",
    icon: "Award"
  }
];
