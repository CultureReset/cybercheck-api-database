window.BUSINESS_DATA = {

  // ── Core Info ──────────────────────────────────────────────
  name:         "Cobalt The Restaurant",
  slug:         "cobalt-the-restaurant",
  tagline:      "Fresh Gulf Seafood & Waterfront Dining",
  category:     "Restaurant",
  emoji:        "🦀",
  phone:        "2519235300",
  phoneDisplay: "(251) 923-5300",
  address:      "28099 Perdido Beach Blvd",
  city:         "Orange Beach",
  state:        "Alabama",
  zip:          "36561",
  website:      "https://www.cobaltrestaurant.net",
  googleMaps:   "https://maps.google.com/?q=28099+Perdido+Beach+Blvd,+Orange+Beach,+Alabama,+36561",
  instagram:    "",
  facebook:     "",
  rating:       4.7,
  reviewCount:  0,

  // ── Cover Images ────────────────────────────────────────────
  coverImages: [
    "../business-images/cobalt-the-restaurant/cobalt-cover.jpg",
  ],

  // ── Gallery ─────────────────────────────────────────────────
  gallery: [],

  // ── Reviews ─────────────────────────────────────────────────
  reviews: [],

  // ── About ───────────────────────────────────────────────────
  about: {
    description: "Cobalt The Restaurant offers waterfront fine dining in Orange Beach, Alabama, featuring the freshest Gulf seafood, hand-crafted cocktails, stone hearth pizzas, and an extensive wine list. From signature dishes like Gulf Shrimp & Grits and our famous Crab Bisque to hand-cut steaks and Sunday Brunch, every visit is an unforgettable coastal dining experience.",
    features: [
      "Fresh Gulf Seafood", "Stone Hearth Pizza", "Full Bar & Wine List",
      "Sunday Brunch 11am–2pm", "Happy Hour Daily 3–5pm", "Waterfront Views",
      "Gluten-Free Menu", "Kids Menu", "Private Dining Available"
    ],
    perfectFor: [
      "Date night", "Family dining", "Special occasions",
      "Sunday brunch", "Business lunch", "Waterfront dining",
      "Fresh seafood lovers", "Wine enthusiasts", "Group dinners"
    ]
  },

  // ── Hours ───────────────────────────────────────────────────
  hours: [
    { day: "Monday",    open: "11:00 AM", close: "9:30 PM" },
    { day: "Tuesday",   open: "11:00 AM", close: "9:30 PM" },
    { day: "Wednesday", open: "11:00 AM", close: "9:30 PM" },
    { day: "Thursday",  open: "11:00 AM", close: "9:30 PM" },
    { day: "Friday",    open: "11:00 AM", close: "10:00 PM" },
    { day: "Saturday",  open: "11:00 AM", close: "10:00 PM" },
    { day: "Sunday",    open: "11:00 AM", close: "9:30 PM" }
  ],

  // ── Happy Hour ───────────────────────────────────────────────
  happyHour: {
    schedule: "Daily 3:00 PM – 5:00 PM",
    deals: [
      // ── Drink Specials ──
      { name: "Urban South Paradise Park Draft",    price: "$2.50" },
      { name: "Luna's House Brew",                  price: "$2.50" },
      { name: "Good People Muchacho",               price: "$3.00" },
      { name: "Braided River Hoppy by Nature IPA",  price: "$5.00" },
      { name: "House Wine",                         price: "$3.00" },
      { name: "Well Drinks",                        price: "$3.50" },
      // ── Food Specials ──
      { name: "Raw Oysters",         desc: "Market price",                                                                                                  price: "Market" },
      { name: "Cheese Pizza",                                                                                                                                price: "$8" },
      { name: "Cobalt Caviar",       desc: "Black beans, edamame, corn, red onion, Roma tomatoes, cilantro in light vinaigrette with corn tortilla chips",  price: "$5" },
      { name: "Cheese Dip",          desc: "Parmesan & Swiss cheeses, Cotija, poblano green tomato relish, corn chips",                                     price: "$8" },
      { name: "Firecracker Shrimp",  desc: "Lightly dusted bay shrimp fried and tossed in spicy remoulade",                                                 price: "$8" },
    ]
  },

  // ── Food Menu ───────────────────────────────────────────────
  // Each category has a `meal` property matching its sec.id in sections[]
  foodMenu: [

    // ════════════════════════════════════════════
    //  LUNCH  (Mon–Fri until 3:00 PM)
    // ════════════════════════════════════════════
    {
      meal: "lunch",
      category: "Appetizers",
      note: "Lunch served Monday – Friday until 3:00 PM",
      items: [
        { name: "Crab Claws",                desc: "Lightly fried and served with cocktail sauce.",                                                                                                                       price: "Market" },
        { name: "Tuna and Avocado Stack",    desc: "Sashimi grade tuna and avocado tossed in sweet Asian sauce, served between crisp wontons.",                                                                           price: "$14" },
        { name: "BBQ Gulf Shrimp",           desc: "Sautéed in a Creole butter sauce and served with grilled French bread. Add double shrimp +$8.",                                                                       price: "$15" },
        { name: "Firecracker Shrimp",        desc: "Lightly dusted bay shrimp fried and tossed in spicy remoulade sauce.",                                                                                                price: "$14" },
        { name: "Cobalt Crab & Shrimp Dip",  desc: "Hot creamy blend of fresh blue crab and tender bay shrimp with roasted sweet red peppers, Parmesan and Swiss cheese. Accompanied by grilled French bread.",          price: "$15" },
        { name: "Cobalt Caviar",             desc: "Black beans, edamame, corn, red onion, Roma tomatoes and cilantro tossed in light vinaigrette with corn tortilla chips.",                                             price: "$9" },
        { name: "Crab and Scallop Cakes",    desc: "Three fried crab and scallop cakes served over cole slaw, topped with charred green tomato remoulade.",                                                              price: "$13" },
        { name: "Cobalt Cheese Dip",         desc: "Velvety blend of parmesan and Swiss cheeses, topped with Cotija cheese and poblano green tomato relish. Served with crisp corn chips.",                              price: "$10" },
      ]
    },
    {
      meal: "lunch",
      category: "Oysters",
      note: "Half Dozen or Dozen — Market Price",
      items: [
        { name: "Raw",                         desc: "Gulf raw oysters served with cocktail sauce and horseradish." },
        { name: "Creole Casino",               desc: "Topped with tasso, jalapeño, red bell pepper, shallots, cream cheese and smoked Gouda. With grilled French bread." },
        { name: "Garlic Parmesan Chargrilled", desc: "Topped with garlic butter and savory Parmesan cheese. With grilled French bread." },
        { name: "Rockefeller",                 desc: "Spinach, garlic, shallots, parsley, anchovies and green onion with a hint of anisette. With grilled French bread." },
        { name: "Combination",                 desc: "All three — Garlic Parmesan, Creole Casino and Rockefeller. With grilled French bread." },
      ]
    },
    {
      meal: "lunch",
      category: "Soups",
      items: [
        { name: "Cobalt Crab Bisque",  desc: "Creamy blend of sweet blue crab, sweet corn and roasted tomato.",  price: "Cup $6 / Bowl $10" },
        { name: "Soup Of The Day",                                                                                price: "Cup $6 / Bowl $10" },
      ]
    },
    {
      meal: "lunch",
      category: "Salads",
      note: "Dressings: Champagne Citrus Vinaigrette, Honey Mustard, Bleu Cheese, Honey Balsamic Vinaigrette, Thousand Island, Ranch",
      items: [
        { name: "House Salad",       desc: "Crisp romaine and spring greens with tomato, red onions, cucumbers and peppadews.",                                                                                                                                             price: "Small $4 / Large $10" },
        { name: "Caesar",            desc: "Romaine, housemade traditional dressing, croutons and shaved Parmesan.",                                                                                                                                                        price: "Small $6 / Large $12" },
        { name: "Cobalt Wedge",      desc: "Baby iceberg with tomato, cucumber, diced red onion, applewood smoked bacon, bleu cheese crumbles and creamy bleu cheese dressing. Brian Style +$7 (no tomatoes, add peppadews, hard boiled egg & blackened chicken).",       price: "$12" },
        { name: "Blackened Tuna",    desc: "Over mixed greens in Champagne citrus vinaigrette with candied Baldwin County pecans, crumbled goat cheese, orange segments and house pickled vegetables.",                                                                     price: "$20" },
      ]
    },
    {
      meal: "lunch",
      category: "Salad Enhancements",
      items: [
        { name: "Chicken (Grilled, Blackened or Fried)",  price: "$6" },
        { name: "Two Fried Crab and Scallop Cakes",       price: "$6" },
        { name: "Sautéed Blue Crab",                      price: "$7" },
        { name: "Shrimp (Grilled, Blackened or Fried)",   price: "$8" },
        { name: "Fish (Grilled, Blackened or Fried)",     price: "Market" },
        { name: "Blackened Yellowfin Tuna",               price: "$13" },
      ]
    },
    {
      meal: "lunch",
      category: "Entrées",
      items: [
        { name: "Fresh Catch",             desc: "Grilled, blackened or fried with jambalaya rice and brown butter green beans. Oscar style +$9.",                                               price: "Market" },
        { name: "Pecan Fried Catfish",     desc: "Alabama farm-raised filet over tasso ham, sweet corn and black-eyed pea succotash drizzled with dill tartar.",                                price: "$14.50" },
        { name: "Gulf Shrimp and Grits",   desc: "Half dozen large Gulf shrimp skewered, chargrilled, topped with Cajun cream sauce over buttermilk pepper jack cheese grits.",                price: "$14" },
        { name: "Fried Shrimp Platter",   desc: "Lightly dusted fried Gulf shrimp with fries, cole slaw and cocktail or tartar sauce.",                                                        price: "$16" },
        { name: "Fried Fish Platter",     desc: "Lightly dusted fried Gulf fish with fries, cole slaw and cocktail or tartar sauce.",                                                          price: "$16" },
        { name: "Fried Oyster Platter",   desc: "Lightly dusted fried Gulf oysters with fries, cole slaw and cocktail or tartar sauce.",                                                       price: "$17" },
      ]
    },
    {
      meal: "lunch",
      category: "Stone Hearth Pizza",
      note: "Additional toppings $2 each · Toppings: Mozzarella, Parmesan, Smoked Gouda, Fresh Mozzarella, Bacon, Pepperoni, Italian Sausage, Ground Beef, Grilled Chicken, Peppers, Onions, Anchovies, Roasted Tomatoes, Black Olives, Pineapple, Spinach, Jalapeños, Roasted Mushrooms, Banana Peppers",
      items: [
        { name: "Margherita",          desc: "House crust with EVOO, sea salt and cracked pepper, oven roasted Roma tomatoes, fresh mozzarella and basil chiffonade.",         price: "10\" — $14" },
        { name: "Cobalt Pizza",        desc: "Grilled chicken, smoked bacon, fresh spinach & arugula, oven roasted mushrooms and sautéed onions, marinara, mozzarella, smoked Gouda.", price: "10\" — $17" },
        { name: "Build Your Own",      desc: "Sauce: Marinara, Alfredo or Roasted Garlic Oil. Additional toppings $2 each.",                                                   price: "10\" Cheese — $11" },
      ]
    },
    {
      meal: "lunch",
      category: "Pasta",
      items: [
        { name: "Chicken Parmesan",    desc: "Parmesan and Italian herb-crusted chicken over angel hair pasta tossed in house-made marinara.",                                                                                              price: "$14" },
        { name: "Zydeco Chicken",      desc: "Blackened chicken with spicy housemade tasso ham, sweet onions, bell peppers and fresh pappardelle pasta tossed in Cajun alfredo.",                                                         price: "$18" },
        { name: "Shrimp Fra Diavolo",  desc: "Gulf shrimp sautéed with roasted mushrooms, onions, chargrilled lemon, fresh spinach and arugula with spicy marinara and angel hair pasta.",                                               price: "$18" },
      ]
    },
    {
      meal: "lunch",
      category: "Sandwiches",
      note: "All sandwiches served with your choice of one $4 side",
      items: [
        { name: "Cobalt Beast Burger",           desc: "Elk, wild boar, wagyu and bison blackened and topped with bleu cheese, bacon and caramelized onions on a brioche bun with garlic aioli.",                              price: "$20" },
        { name: "The Do It Yourselfer",          desc: "Certified Angus Beef® ground chuck, short rib and brisket, hand pattied and grilled on toasted sourdough with romaine, tomatoes and red onions. Cheese +$1, toppings +$2.", price: "$14" },
        { name: "Sweet Heat Chicken Sandwich",   desc: "Lightly fried chicken tossed in sweet heat sauce on sourdough with lettuce, tomato, onion, housemade B&B pickles, garlic aioli and provolone.",                       price: "$13" },
        { name: "Super Grilled Cheese",          desc: "Smoked Gouda, Parmesan, Swiss, provolone and American cheeses with bacon and tomatoes on BuzzCatz bread.",                                                            price: "$13" },
        { name: "Shrimp Po' Boy",                desc: "Served on a toasted French loaf with lettuce and tomato.",                                                                                                            price: "$14" },
        { name: "Fish Po' Boy",                  desc: "Served on a toasted French loaf with lettuce and tomato.",                                                                                                            price: "$17" },
        { name: "Oyster Po' Boy",                desc: "Served on a toasted French loaf with lettuce and tomato.",                                                                                                            price: "$17" },
        { name: "Fish Sandwich",                 desc: "Today's fresh selection grilled, blackened or fried on a toasted sourdough bun with lettuce, tomato and onion.",                                                      price: "Market" },
        { name: "Tuna Melt",                     desc: "Housemade tuna salad on BuzzCatz bread, oven roasted, served with aioli, lettuce, tomatoes and shredded cheddar.",                                                   price: "$13" },
      ]
    },
    {
      meal: "lunch",
      category: "Sides",
      items: [
        { name: "Brown Butter Green Beans",                price: "$5" },
        { name: "Creamy Parmesan Risotto",                 price: "$5" },
        { name: "Grilled Asparagus",                       price: "$5" },
        { name: "Tasso Ham Succotash",                     price: "$5" },
        { name: "Fried Brussels Sprouts",                  price: "$5" },
        { name: "Smoked Cheddar Bacon Mashed Potatoes",    price: "$4" },
        { name: "Jambalaya Rice",                          price: "$4" },
        { name: "Buttermilk Pepper Jack Cheese Grits",     price: "$4" },
        { name: "Cole Slaw",                               price: "$4" },
        { name: "French Fries",                            price: "$4" },
      ]
    },
    {
      meal: "lunch",
      category: "Sweet Treats",
      items: [
        { name: "Fried Apple Pie",           desc: "Homemade biscuit dough filled with apples and cinnamon, deep fried, served with vanilla ice cream and caramel sauce.",                                             price: "$9" },
        { name: "Creole Cheesecake",         desc: "Housemade Creole cream cheese with a roasted pecan crust, pecan praline and caramel sauce.",                                                                       price: "$9" },
        { name: "Triple Layer Chocolate Cake", desc: "Rich chocolate buttercream icing between moist chocolate cake layers, garnished with housemade espresso ice cream. Add a drizzle of Chambord, Kaluha, Bailey's or Frangelico +$4.", price: "$9" },
        { name: "Key Lime Pie",              desc: "Traditional pie made with real key lime juice, served with blackberry coulis and whipped cream.",                                                                   price: "$9" },
        { name: "Vanilla Bean Crème Brûlée", desc: "Traditional French custard with a crisp shell of turbinado sugar.",                                                                                                price: "$9" },
        { name: "Bread Pudding",             desc: "Baked fresh everyday. Ask your server about today's selection.",                                                                                                    price: "$8" },
      ]
    },

    // ════════════════════════════════════════════
    //  DINNER
    // ════════════════════════════════════════════
    {
      meal: "dinner",
      category: "Appetizers",
      items: [
        { name: "Crab Claws",                desc: "Lightly fried and served with cocktail sauce.",                                                                                                                       price: "Market" },
        { name: "Tuna and Avocado Stack",    desc: "Sashimi grade tuna and avocado tossed in sweet Asian sauce, served between crisp wontons.",                                                                           price: "$14" },
        { name: "BBQ Gulf Shrimp",           desc: "Sautéed in a Creole butter sauce and served with grilled French bread. Add double shrimp +$8.",                                                                       price: "$15" },
        { name: "Firecracker Shrimp",        desc: "Lightly dusted bay shrimp fried and tossed in spicy remoulade sauce.",                                                                                                price: "$14" },
        { name: "Cobalt Crab & Shrimp Dip",  desc: "Hot creamy blend of fresh blue crab and tender bay shrimp with roasted sweet red peppers, Parmesan and Swiss cheese. Accompanied by grilled French bread.",          price: "$15" },
        { name: "Cobalt Caviar",             desc: "Black beans, edamame, corn, red onion, Roma tomatoes and cilantro tossed in light vinaigrette with corn tortilla chips.",                                             price: "$10" },
        { name: "Crab and Scallop Cakes",    desc: "Three fried crab and scallop cakes served with cole slaw, topped with charred green tomato remoulade.",                                                              price: "$13" },
        { name: "Cobalt Cheese Dip",         desc: "Velvety blend of parmesan and Swiss cheeses, topped with Cotija cheese and poblano green tomato relish. Served with corn tortilla chips.",                           price: "$10" },
      ]
    },
    {
      meal: "dinner",
      category: "Oysters",
      note: "Half Dozen or Dozen — Market Price",
      items: [
        { name: "Raw",                         desc: "Gulf raw oysters served with cocktail sauce and horseradish." },
        { name: "Creole Casino",               desc: "Topped with tasso, jalapeño, red bell pepper, shallots, cream cheese and smoked Gouda. With grilled French bread." },
        { name: "Garlic Parmesan Chargrilled", desc: "Topped with garlic butter and savory Parmesan cheese. With grilled French bread." },
        { name: "Rockefeller",                 desc: "Spinach, garlic, shallots, parsley, anchovies and green onion with a hint of anisette. Topped with Parmesan. With grilled French bread." },
        { name: "Combination",                 desc: "All three — Garlic Parmesan, Creole Casino and Rockefeller. With grilled French bread." },
      ]
    },
    {
      meal: "dinner",
      category: "Soups",
      items: [
        { name: "Cobalt Crab Bisque",  desc: "Creamy blend of sweet blue crab, sweet corn and roasted tomato.",  price: "Cup $6 / Bowl $10" },
        { name: "Soup Of The Day",                                                                                price: "Cup $6 / Bowl $10" },
      ]
    },
    {
      meal: "dinner",
      category: "Salads",
      note: "Dressings: Champagne Citrus Vinaigrette, Honey Mustard, Bleu Cheese, Honey Balsamic Vinaigrette, Thousand Island, Ranch",
      items: [
        { name: "House Salad",       desc: "Crisp romaine and spring greens with tomato, red onions, cucumbers and peppadews.",                                                                                                                                             price: "Small $4 / Large $10" },
        { name: "Caesar",            desc: "Romaine, housemade traditional dressing, croutons and shaved Parmesan.",                                                                                                                                                        price: "Small $6 / Large $12" },
        { name: "Cobalt Wedge",      desc: "Baby iceberg with tomato, cucumber, diced red onion, applewood smoked bacon, bleu cheese crumbles and creamy bleu cheese dressing. Brian Style +$7.",                                                                           price: "$12" },
        { name: "Blackened Tuna",    desc: "Over mixed greens in Champagne citrus vinaigrette with candied Baldwin County pecans, crumbled goat cheese, orange segments and house pickled vegetables.",                                                                     price: "$20" },
      ]
    },
    {
      meal: "dinner",
      category: "Salad Enhancements",
      items: [
        { name: "Chicken (Grilled, Blackened or Fried)",  price: "$6" },
        { name: "Two Fried Crab and Scallop Cakes",       price: "$6" },
        { name: "Sautéed Blue Crab",                      price: "$7" },
        { name: "Shrimp (Grilled, Blackened or Fried)",   price: "$8" },
        { name: "Fish (Grilled, Blackened or Fried)",     price: "Market" },
        { name: "Blackened Yellowfin Tuna",               price: "$13" },
      ]
    },
    {
      meal: "dinner",
      category: "Entrées",
      note: "Housemade Sauces +$2: Louisiana Hot Sauce Hollandaise, Cajun Cream, Cobalt Steak Butter, Charred Green Tomato Remoulade, Port Demi-Glace",
      items: [
        { name: "Fresh Catch",                 desc: "Grilled, blackened or fried with jambalaya rice and brown butter green beans. Oscar style +$9.",                                                                                                         price: "Market" },
        { name: "Surf-n-Surf",                 desc: "Blackened Gulf yellowfin tuna and two fried crab and scallop cakes over buttermilk pepper jack cheese grits and grilled asparagus. Topped with charred green tomato remoulade and Louisiana hot hollandaise.",  price: "$35" },
        { name: "Bronzed Gulf Grouper",        desc: "Served over Parmesan risotto, topped with Cajun cream sautéed blue crab.",                                                                                                                               price: "Market" },
        { name: "Pecan Fried Catfish",         desc: "Alabama farm-raised filets over tasso ham, sweet corn and black-eyed pea succotash drizzled with dill tartar.",                                                                                          price: "$26" },
        { name: "Gulf Shrimp and Grits",       desc: "One dozen large Gulf shrimp skewered, chargrilled, topped with Cajun cream sauce over buttermilk pepper jack cheese grits.",                                                                             price: "$25" },
        { name: "Blackened Redfish",           desc: "Served with jambalaya rice, grilled asparagus and Louisiana Hot Sauce hollandaise. Add sautéed blue crab +$7.",                                                                                          price: "$31" },
        { name: "Fried Shrimp Platter",       desc: "Lightly dusted fried Gulf shrimp with fries, cole slaw and cocktail or tartar sauce.",                                                                                                                    price: "$24" },
        { name: "Fried Fish Platter",         desc: "Lightly dusted fried Gulf fish with fries, cole slaw and cocktail or tartar sauce.",                                                                                                                      price: "$24" },
        { name: "Fried Oyster Platter",       desc: "Lightly dusted fried Gulf oysters with fries, cole slaw and cocktail or tartar sauce.",                                                                                                                   price: "$26" },
        { name: "White BBQ Pork Tenderloin",   desc: "8 oz. pork tenderloin marinated in white BBQ and grilled. Served with Brie cream gnocchi, fried Brussels sprouts, fried onion rings, and pepper jelly.",                                                price: "$24" },
        { name: "Delmonico Ribeye",            desc: "14 oz. Delmonico ribeye with smoked cheddar bacon mashed potatoes, brown butter green beans, and port demi-glace.",                                                                                      price: "$43" },
        { name: "Filet",                       desc: "8 oz. center cut filet over smoked cheddar bacon mashed potatoes, grilled asparagus, topped with Cobalt steak butter.",                                                                                  price: "$41" },
        { name: "Free Range Chicken Breast",   desc: "Pan-seared bone-in chicken over buttermilk pepper jack cheese grits, fried Brussels sprouts, topped with Creole tasso gravy.",                                                                           price: "$22" },
        { name: "Seasonal Butcher's Block",    desc: "Fresh seasonal vegetables and choice cuts of beef, game, and seafood. Ask your server for details.",                                                                                                     price: "Market" },
      ]
    },
    {
      meal: "dinner",
      category: "Surf-n-Turf Additions",
      items: [
        { name: "Chicken (Grilled, Blackened or Fried)",  price: "$6" },
        { name: "Two Fried Crab and Scallop Cakes",       price: "$6" },
        { name: "Sautéed Blue Crab",                      price: "$7" },
        { name: "Shrimp (Grilled, Blackened or Fried)",   price: "$8" },
        { name: "Oscar Topped",                           price: "$9" },
        { name: "Fish (Grilled, Blackened or Fried)",     price: "Market" },
        { name: "Blackened Yellowfin Tuna",               price: "$13" },
      ]
    },
    {
      meal: "dinner",
      category: "Pasta",
      items: [
        { name: "Zydeco Chicken",          desc: "Blackened chicken with spicy housemade tasso ham, sweet onions, bell peppers and fresh pappardelle pasta tossed in Cajun alfredo.",                                                             price: "$21" },
        { name: "Shrimp Fra Diavolo",      desc: "Gulf shrimp sautéed with roasted mushrooms, onions, chargrilled lemon, fresh spinach and arugula with spicy marinara and angel hair pasta.",                                                   price: "$21" },
        { name: "Crab and Scallop Gnocchi", desc: "Sea scallops and fresh blue crab sautéed with onions, spinach, tomatoes, and sweet peppers tossed in Brie cream with gnocchi.",                                                              price: "$26" },
      ]
    },
    {
      meal: "dinner",
      category: "Stone Hearth Pizza",
      note: "Additional toppings $2 each",
      items: [
        { name: "Margherita",     desc: "House crust with EVOO, sea salt and cracked pepper, oven roasted Roma tomatoes, fresh mozzarella and basil chiffonade.",         price: "10\" — $14" },
        { name: "Cobalt Pizza",   desc: "Grilled chicken, smoked bacon, fresh spinach & arugula, oven roasted mushrooms and sautéed onions, marinara, mozzarella, smoked Gouda.", price: "10\" — $17" },
        { name: "Build Your Own", desc: "Sauce: Marinara, Alfredo or Roasted Garlic Oil. Additional toppings $2 each.",                                                   price: "10\" Cheese — $11" },
      ]
    },
    {
      meal: "dinner",
      category: "Sandwiches",
      note: "All sandwiches served with your choice of one $4 side",
      items: [
        { name: "Cobalt Beast Burger",   desc: "Elk, wild boar, wagyu and bison blackened and topped with bleu cheese, bacon and caramelized onions on a brioche bun with garlic aioli.",  price: "$20" },
        { name: "The Do It Yourselfer",  desc: "Certified Angus Beef® ground chuck, short rib and brisket, hand pattied and grilled on toasted sourdough. Cheese +$1, toppings +$2.",     price: "$14" },
        { name: "Shrimp Po' Boy",        desc: "Served on a toasted French loaf with lettuce and tomato.",                                                                                 price: "$14" },
        { name: "Fish Po' Boy",          desc: "Served on a toasted French loaf with lettuce and tomato.",                                                                                 price: "$17" },
        { name: "Oyster Po' Boy",        desc: "Served on a toasted French loaf with lettuce and tomato.",                                                                                 price: "$17" },
        { name: "Fish Sandwich",         desc: "Today's fresh selection grilled, blackened or fried on a toasted sourdough bun with lettuce, tomato and onion.",                           price: "Market" },
      ]
    },
    {
      meal: "dinner",
      category: "Sides",
      items: [
        { name: "Brown Butter Green Beans",                    price: "$5" },
        { name: "Creamy Parmesan Risotto",                     price: "$5" },
        { name: "Grilled Asparagus",                           price: "$5" },
        { name: "Tasso Ham, Corn & Black-Eyed Pea Succotash",  price: "$5" },
        { name: "Fried Brussels Sprouts",                      price: "$5" },
        { name: "Smoked Cheddar Bacon Mashed Potatoes",        price: "$4" },
        { name: "Jambalaya Rice",                              price: "$4" },
        { name: "Buttermilk Pepper Jack Cheese Grits",         price: "$4" },
        { name: "Cole Slaw",                                   price: "$4" },
        { name: "French Fries",                                price: "$4" },
      ]
    },
    {
      meal: "dinner",
      category: "Sweet Treats",
      items: [
        { name: "Fried Apple Pie",              desc: "Homemade biscuit dough filled with apples and cinnamon, deep fried, served with vanilla ice cream and caramel sauce.",                                                                          price: "$9" },
        { name: "Creole Cheesecake",            desc: "Housemade Creole cream cheese with a roasted pecan crust, pecan praline and caramel sauce.",                                                                                                    price: "$9" },
        { name: "Triple Layer Chocolate Cake",  desc: "Rich chocolate buttercream icing between moist chocolate cake layers, garnished with housemade espresso ice cream. Add a drizzle of Chambord, Kaluha, Bailey's or Frangelico +$4.",            price: "$9" },
        { name: "Key Lime Pie",                 desc: "Traditional pie made with real key lime juice, served with blackberry coulis and whipped cream.",                                                                                               price: "$9" },
        { name: "Vanilla Bean Crème Brûlée",    desc: "Traditional French custard with a crisp shell of turbinado sugar.",                                                                                                                             price: "$9" },
        { name: "Bread Pudding",                desc: "Baked fresh everyday. Ask your server about today's selection.",                                                                                                                                price: "$9" },
      ]
    },

    // ════════════════════════════════════════════
    //  SUNDAY BRUNCH  (Every Sunday 11am–2pm)
    // ════════════════════════════════════════════
    {
      meal: "brunch",
      category: "Eggs Benedict",
      note: "Served every Sunday from 11 AM to 2 PM · All Benedict dishes come with fresh fruit, brunch bread, and your choice of buttermilk pepper jack cheese grits or Potatoes O'Brien",
      items: [
        { name: "Crab and Scallop Cake Benedict",  desc: "Two house-made fried blue crab and scallop cakes over an English muffin, topped with poached eggs and fire roasted red bell pepper hollandaise.",                 price: "$15" },
        { name: "Traditional Benedict",            desc: "Two English muffins layered with smoked Canadian bacon, topped with poached eggs and drizzled with Louisiana hot sauce hollandaise.",                              price: "$12" },
      ]
    },
    {
      meal: "brunch",
      category: "Omelets",
      note: "All omelets made with 3 eggs, served with fresh fruit, brunch bread, and your choice of buttermilk pepper jack cheese grits or Potatoes O'Brien",
      items: [
        { name: "Western Omelet",    desc: "Andouille sausage, tomato, onion, tasso, and cheddar. Topped with house-made salsa.",                          price: "$14" },
        { name: "Seafood Omelet",    desc: "Bay shrimp, blue crab, spinach, onion, and Parmesan. Topped with roasted red bell pepper hollandaise.",        price: "$18" },
        { name: "Vegetable Omelet",  desc: "Tomato, spinach, onion, and bell pepper.",                                                                    price: "$12" },
        { name: "Cheese Omelet",     desc: "Everything's better with cheddar!",                                                                            price: "$11" },
      ]
    },
    {
      meal: "brunch",
      category: "Brunch Specials",
      items: [
        { name: "Shrimp and Grits",           desc: "Gulf shrimp sautéed with onions and housemade tasso and sherry cream sauce. Served over buttermilk pepper jack cheese grits.",                                 price: "$16" },
        { name: "French Toast",               desc: "Traditional French toast topped with fruit compote of the day, powdered sugar, and a side of bacon.",                                                          price: "$11" },
        { name: "Blackened Fish of the Day",  desc: "Fish of the day blackened with house Creole seasoning. Served with cilantro pilaf and citrus beurre blanc.",                                                   price: "$14" },
        { name: "Potatoes O'Brien and Eggs",  desc: "Oven roasted Potatoes O'Brien with house-made tasso and three eggs, topped with melted cheddar and roasted red bell pepper hollandaise.",                     price: "$11" },
        { name: "The Roscoe",                 desc: "Lightly fried chicken tossed in sweet heat sauce with French toast. Topped with fruit compote of the day and drizzled with honey.",                           price: "$13" },
      ]
    },
    {
      meal: "brunch",
      category: "Brunch Drinks",
      items: [
        { name: "Mimosa",      price: "$4" },
        { name: "Poinsetta",   price: "$4" },
        { name: "Bloody Mary", price: "$4" },
        { name: "Screwdriver", price: "$4" },
        { name: "Champagne",   price: "$5" },
      ]
    },
    {
      meal: "brunch",
      category: "Brunch Sides",
      items: [
        { name: "Buttermilk Pepper Jack Cheese Grits",  price: "$4" },
        { name: "Potatoes O'Brien",                     price: "$4" },
        { name: "Bacon",                                price: "$4" },
        { name: "Fresh Fruit",                          price: "$4" },
      ]
    },

    // ════════════════════════════════════════════
    //  KIDS MENU  (Ages 12 & under, lunch or dinner)
    // ════════════════════════════════════════════
    {
      meal: "kids",
      category: "Kids Entrées",
      note: "Ages 12 and under. All entrées served with fries.",
      items: [
        { name: "Hamburger",                  price: "$8" },
        { name: "Cheeseburger",               price: "$9" },
        { name: "Fish (Grilled or Fried)",    price: "$9" },
        { name: "Chicken (Grilled or Fried)", price: "$7" },
        { name: "Fried Shrimp",               price: "$8" },
        { name: "Pasta Marinara",             price: "$5" },
        { name: "Pasta Alfredo",              price: "$7" },
      ]
    },
    {
      meal: "kids",
      category: "Kids Drinks",
      items: [
        { name: "Virgin Frozen Daiquiri",  desc: "Piña Colada, Strawberry, or Banana.",        price: "$6" },
        { name: "Fairlife Milk",           desc: "Classic, Chocolate or Strawberry.",           price: "$2.50" },
        { name: "Juice",                   desc: "Orange or Apple.",                            price: "$2.50" },
        { name: "Abita Rootbeer",                                                               price: "$3.50" },
        { name: "Soft Drinks",             desc: "We proudly serve Coca-Cola products.",        price: "$3.75" },
        { name: "Sweet or Unsweet Tea",                                                         price: "$3.75" },
      ]
    },

    // ════════════════════════════════════════════
    //  GLUTEN-FREE MENU
    // ════════════════════════════════════════════
    {
      meal: "gluten-free",
      category: "Gluten-Free Appetizers",
      items: [
        { name: "Crab Claws",  desc: "Fresh crab claws sautéed in a lemon wine butter sauce.",  price: "Market" },
      ]
    },
    {
      meal: "gluten-free",
      category: "Gluten-Free Salads",
      note: "Dressings: Champagne Citrus Vinaigrette, Honey Mustard, Bleu Cheese, Thousand Island, Honey Balsamic Vinaigrette",
      items: [
        { name: "House Salad",    desc: "Crisp romaine and spring greens with tomato, red onions, cucumbers and peppadews.",                                                                                             price: "Small $4 / Large $10" },
        { name: "Caesar",         desc: "Romaine, housemade traditional dressing and shaved Parmesan.",                                                                                                                  price: "Small $6 / Large $12" },
        { name: "Cobalt Wedge",   desc: "Baby iceberg with tomato, cucumber, diced red onion, applewood smoked bacon, bleu cheese crumbles and creamy bleu cheese dressing. Brian Style +$7.",                          price: "$12" },
        { name: "Blackened Tuna", desc: "Over mixed greens in Champagne citrus vinaigrette with candied Baldwin County pecans, crumbled goat cheese, orange segments and house pickled vegetables.",                    price: "$20" },
      ]
    },
    {
      meal: "gluten-free",
      category: "Gluten-Free Salad Enhancements",
      items: [
        { name: "Chicken (Grilled or Blackened)",  price: "$6" },
        { name: "Sautéed Blue Crab",               price: "$7" },
        { name: "Shrimp (Grilled or Blackened)",   price: "$8" },
        { name: "Fish (Grilled or Blackened)",     price: "Market" },
        { name: "Blackened Yellowfin Tuna",        price: "$13" },
      ]
    },
    {
      meal: "gluten-free",
      category: "Gluten-Free Oysters",
      note: "Half Dozen or Dozen — Market Price",
      items: [
        { name: "Raw",                         desc: "Gulf raw oysters with cocktail sauce and horseradish." },
        { name: "Creole Casino",               desc: "Tasso, jalapeño, red bell pepper, shallots, cream cheese and smoked Gouda." },
        { name: "Garlic Parmesan Chargrilled", desc: "Topped with garlic butter and savory Parmesan cheese." },
      ]
    },
    {
      meal: "gluten-free",
      category: "Gluten-Free Entrées",
      items: [
        { name: "Fresh Catch",         desc: "Grilled or blackened with jambalaya rice and brown butter green beans. Add sautéed blue crab +$7.",   price: "Market" },
        { name: "Bronzed Grouper",     desc: "Served over Parmesan risotto, topped with Cajun cream and sautéed blue crab.",                        price: "Market" },
        { name: "Gulf Shrimp & Grits", desc: "One dozen large Gulf shrimp skewered, chargrilled, topped with Cajun cream over buttermilk pepper jack cheese grits.", price: "$25" },
        { name: "Blackened Redfish",   desc: "Served with jambalaya rice, grilled asparagus and Louisiana Hot Sauce hollandaise. Add sautéed blue crab +$7.", price: "$31" },
        { name: "Delmonico Ribeye",    desc: "14 oz. Delmonico ribeye with smoked cheddar bacon mashed potatoes, brown butter green beans, and port demi-glace.", price: "$43" },
        { name: "Filet",              desc: "8 oz. center cut filet over smoked cheddar bacon mashed potatoes, grilled asparagus, topped with Cobalt steak butter.", price: "$41" },
        { name: "Free Range Chicken Breast", desc: "Pan-seared bone-in chicken over buttermilk pepper jack cheese grits and brown butter green beans.", price: "$22" },
      ]
    },
    {
      meal: "gluten-free",
      category: "Gluten-Free Sides",
      items: [
        { name: "Brown Butter Green Beans",             price: "$5" },
        { name: "Creamy Parmesan Risotto",              price: "$5" },
        { name: "Grilled Asparagus",                    price: "$5" },
        { name: "Smoked Cheddar Bacon Mashed Potatoes", price: "$4" },
        { name: "Jambalaya Rice",                       price: "$4" },
        { name: "Buttermilk Pepper Jack Cheese Grits",  price: "$4" },
        { name: "Cole Slaw",                            price: "$4" },
      ]
    },

  ],

  // ── Bar Menu ────────────────────────────────────────────────
  barMenu: [
    {
      category: "Specialty Cocktails",
      items: [
        { name: "Orange Beach Margarita",  desc: "Lunazul Silver with fresh lemon and lime. Topped with Gran Gala, finished with orange zest and house crafted salt. Upgrade to Don Julio Blanco +$6.",                      price: "$12" },
        { name: "The Lost Paloma",         desc: "Ruby red grapefruit, agave, Tajin, and lime finished with Montelobos Mezcal. Add chili pepper infused lime juice +$1.",                                                   price: "$13" },
        { name: "Bourbon Blush",           desc: "Makers Mark Bourbon smashed with lemon, mint, pomegranate cactus pear juice, and 100% Vermont maple syrup.",                                                              price: "$13" },
        { name: "Espresso Martini",        desc: "Smirnoff Whipped Vodka, Kalúha Coffee Liqueur, Bailey's Irish Cream, and espresso.",                                                                                      price: "$12" },
        { name: "Sangria",                 desc: "Your choice of red or white.",                                                                                                                                             price: "$10" },
        { name: "Ube Squeeze",             desc: "Sweet ube, Smirnoff Raspberry Vodka, and zesty lemonade.",                                                                                                                price: "$11" },
        { name: "Pain Killer",             desc: "Pineapple, orange, and coconut shaken with Captain Morgan Spiced Rum. Topped with nutmeg. Add 151 Rum or Skrewball Peanut Butter Whiskey floater +$3.",                   price: "$11" },
        { name: "The Lei",                 desc: "Captain Morgan Spiced Rum, Cruzan Coconut Rum, Blue Curaçao, and pineapple juice.",                                                                                       price: "$10" },
      ]
    },
    {
      category: "Frozen Drinks",
      items: [
        { name: "Bushwacker",       desc: "Cruzan Coconut Rum, coffee liqueur, dark Crème de Cocoa, and hand scooped vanilla bean ice cream. Add 151 Rum or Skrewball floater +$3.",  price: "$12" },
        { name: "Daiquiris",        desc: "Strawberry, Banana, Piña Colada, or Strawberry Colada blended with house rum.",                                                             price: "$12" },
        { name: "Frozen Margarita", desc: "House tequila and Pelican Bay margarita mix. Finished with a salt rim and lime.",                                                           price: "$12" },
      ]
    },
    // ── WHITE WINES ──
    {
      category: "Chardonnay",
      items: [
        { name: "Seasun by Caymus — California",             price: "Glass $9 / Bottle $27" },
        { name: "Josh Cellars Craftsmen Collection — California", price: "Glass $10 / Bottle $30" },
        { name: "Duckhorn Decoy — California",               price: "Glass $11 / Bottle $33" },
        { name: "La Crema — Monterey, California",           price: "Glass $13 / Bottle $39" },
        { name: "Rombauer — Carneros, California",           price: "Bottle $93" },
      ]
    },
    {
      category: "Pinot Gris & Pinot Grigio",
      items: [
        { name: "Kris — Delle Venezie, Italy",            price: "Glass $9 / Bottle $27" },
        { name: "J Vineyards Pinot Gris — California",    price: "Glass $11 / Bottle $33" },
        { name: "Santa Margherita — Alto-Adige, Italy",   price: "Bottle $54" },
      ]
    },
    {
      category: "Sauvignon Blanc",
      items: [
        { name: "Emmolo — California",                              price: "Glass $10 / Bottle $30" },
        { name: "Mohua — Marlborough, New Zealand",                 price: "Glass $11 / Bottle $33" },
        { name: "Whitehaven — Marlborough, New Zealand",            price: "Glass $12 / Bottle $36" },
        { name: "Napa Cellars — Napa Valley, California",           price: "Glass $13 / Bottle $39" },
        { name: "Orin Swift Blank Stare — Russian River Valley",    price: "Bottle $71" },
        { name: "Domaine Reverdy-Ducroux, Sancerre — France",       price: "Bottle $75" },
      ]
    },
    {
      category: "Riesling",
      items: [
        { name: "Dr. Loosen — Mosel, Germany",           price: "Glass $10 / Bottle $30" },
        { name: "Riesling — Columbia Valley, Washington", price: "Glass $11 / Bottle $33" },
      ]
    },
    {
      category: "Rosé",
      // NOTE: wine names missing from source data — update when available
      items: [
        { name: "Rosé — Oregon",                   price: "Glass $10 / Bottle $30" },
        { name: "Rosé — Cotes de Provence, France", price: "Glass $13 / Bottle $39" },
      ]
    },
    {
      category: "Sparkling",
      // NOTE: several wine names missing from source data — update when available
      items: [
        { name: "Prosecco DOC — Italy",        price: "Glass $9" },
        { name: "Sparkling — Mendoza, Argentina", price: "Glass $9 / Bottle $27" },
        { name: "Sparkling — California",        price: "Glass $11 / Bottle $33" },
        { name: "Prosecco DOC — Italy",          price: "Bottle $34" },
        { name: "Champagne — France",            price: "Bottle $100" },
        { name: "Champagne — France",            price: "Bottle $134" },
      ]
    },
    {
      category: "Other Whites",
      // NOTE: wine names missing from source data — update when available
      items: [
        { name: "White — California",          price: "Glass $9 / Bottle $27" },
        { name: "White — Rioja DOCa, Spain",   price: "Glass $10 / Bottle $30" },
        { name: "Moscato d'Asti DOCG — Italy", price: "Glass $11 / Bottle $33" },
        { name: "White — Rioja DOCa, Spain",   price: "Glass $12 / Bottle $36" },
        { name: "White — Rogue Valley, Oregon", price: "Glass $13 / Bottle $39" },
        { name: "White — California",          price: "Bottle $60" },
      ]
    },
    // ── RED WINES ──
    {
      category: "Pinot Noir",
      // NOTE: wine names missing from source data — update when available
      items: [
        { name: "Pinot Noir — California",                        price: "Glass $9 / Bottle $27" },
        { name: "Pinot Noir — California",                        price: "Glass $10 / Bottle $30" },
        { name: "Pinot Noir — Oregon",                            price: "Glass $12 / Bottle $36" },
        { name: "Pinot Noir — Russian River Valley, California",  price: "Glass $14 / Bottle $42" },
        { name: "Pinot Noir — Santa Maria Valley, California",    price: "Bottle $60" },
        { name: "Pinot Noir — Willamette Valley, Oregon",         price: "Bottle $75" },
      ]
    },
    {
      category: "Cabernet Sauvignon",
      // NOTE: wine names missing from source data — update when available
      items: [
        { name: "Cabernet — Columbia Valley, Washington",    price: "Glass $9 / Bottle $27" },
        { name: "Cabernet — California",                     price: "Glass $12 / Bottle $36" },
        { name: "Cabernet — North Coast, California",        price: "Glass $13 / Bottle $39" },
        { name: "Cabernet — Alexander Valley, California",   price: "Bottle $57" },
        { name: "Cabernet — Paso Robles, California",        price: "Bottle $75" },
      ]
    },
    {
      category: "Merlot",
      // NOTE: wine names missing from source data — update when available
      items: [
        { name: "Merlot — California",             price: "Glass $9 / Bottle $27" },
        { name: "Merlot — Sonoma Valley, California", price: "Glass $13 / Bottle $39" },
        { name: "Merlot — Napa Valley, California",  price: "Bottle $63" },
      ]
    },
    {
      category: "Malbec",
      // NOTE: wine names missing from source data — update when available
      items: [
        { name: "Malbec — Mendoza, Argentina",          price: "Glass $9 / Bottle $27" },
        { name: "Malbec (Reserve) — Mendoza, Argentina", price: "Bottle $45" },
      ]
    },
    {
      category: "Zinfandel",
      // NOTE: wine names missing from source data — update when available
      items: [
        { name: "Zinfandel — Paso Robles, California", price: "Glass $13 / Bottle $39" },
        { name: "Zinfandel — California",              price: "Bottle $57" },
      ]
    },
    {
      category: "Other Reds",
      // NOTE: wine names missing from source data — update when available
      items: [
        { name: "Red Blend — Columbia Valley, Washington",                price: "Glass $9 / Bottle $27" },
        { name: "Red Blend — Lodi, California",                           price: "Glass $10 / Bottle $30" },
        { name: "Rioja — Rioja DOCa, Spain",                              price: "Glass $10 / Bottle $30" },
        { name: "Red Blend — Dunnigan Hills, Yolo County, California",    price: "Glass $12 / Bottle $36" },
        { name: "Chianti Classico Riserva DOCG — Italy",                  price: "Glass $15 / Bottle $45" },
        { name: "Red — Suisun Valley, California",                        price: "Bottle $48" },
        { name: "Red — Napa Valley, California",                          price: "Bottle $90" },
      ]
    },
    {
      category: "Reserve List",
      // NOTE: wine names missing from source data — update when available
      items: [
        { name: "Reserve — Napa Valley, California",   price: "Bottle $116" },
        { name: "Reserve — Napa Valley, California",   price: "Bottle $126" },
        { name: "Reserve — Napa Valley, California",   price: "Bottle $145" },
        { name: "Reserve — Rutherford, Napa Valley",   price: "Bottle $245" },
        { name: "Reserve — Napa Valley, California",   price: "Bottle $292" },
      ]
    },
  ],

  // ── Sections (sticky nav tabs — order matters) ─────────────
  sections: [
    { id: 'about',        label: 'About',           icon: 'ℹ️' },
    { id: 'happy-hour',   label: 'Happy Hour',       icon: '🍺' },
    { id: 'brunch',       label: 'Sunday Brunch',    icon: '🥂' },
    { id: 'lunch',        label: 'Lunch',            icon: '🍽️' },
    { id: 'dinner',       label: 'Dinner',           icon: '🌙' },
    { id: 'kids',         label: 'Kids Menu',        icon: '👶' },
    { id: 'gluten-free',  label: 'Gluten-Free',      icon: '🌿' },
    // ── Cocktails & Frozen ──
    { id: 'cocktails',    label: 'Cocktails',        icon: '🍹', barCat: 'Specialty Cocktails' },
    { id: 'frozen',       label: 'Frozen',           icon: '🧊', barCat: 'Frozen Drinks' },
    // ── White Wines ──
    { id: 'chardonnay',   label: 'Chardonnay',       icon: '🥂', barCat: 'Chardonnay' },
    { id: 'pinot-gris',   label: 'Pinot Gris',       icon: '🍷', barCat: 'Pinot Gris & Pinot Grigio' },
    { id: 'sauv-blanc',   label: 'Sauv Blanc',       icon: '🍷', barCat: 'Sauvignon Blanc' },
    { id: 'riesling',     label: 'Riesling',         icon: '🍷', barCat: 'Riesling' },
    { id: 'rose',         label: 'Rosé',             icon: '🌹', barCat: 'Rosé' },
    { id: 'sparkling',    label: 'Sparkling',        icon: '✨', barCat: 'Sparkling' },
    { id: 'other-whites', label: 'Other Whites',     icon: '🍷', barCat: 'Other Whites' },
    // ── Red Wines ──
    { id: 'pinot-noir',   label: 'Pinot Noir',       icon: '🍷', barCat: 'Pinot Noir' },
    { id: 'cab-sauv',     label: 'Cabernet',         icon: '🍷', barCat: 'Cabernet Sauvignon' },
    { id: 'merlot',       label: 'Merlot',           icon: '🍷', barCat: 'Merlot' },
    { id: 'malbec',       label: 'Malbec',           icon: '🍷', barCat: 'Malbec' },
    { id: 'zinfandel',    label: 'Zinfandel',        icon: '🍷', barCat: 'Zinfandel' },
    { id: 'other-reds',   label: 'Other Reds',       icon: '🍷', barCat: 'Other Reds' },
    { id: 'reserve',      label: 'Reserve List',     icon: '🏆', barCat: 'Reserve List' },
    // ── Info ──
    { id: 'gallery',      label: 'Photos',           icon: '📸' },
    { id: 'reviews',      label: 'Reviews',          icon: '⭐' },
    { id: 'hours',        label: 'Hours',            icon: '🕐' },
    { id: 'location',     label: 'Location',         icon: '📍' },
  ],

};
