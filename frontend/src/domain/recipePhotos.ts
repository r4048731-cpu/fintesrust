// Фото встроенных рецептов — Викисклад (Wikimedia Commons), свободные лицензии.
// Файлы: public/recipes/<id>.webp, 720×540. Автор и лицензия показываются в карточке рецепта.

export interface RecipePhotoCredit {
  author: string
  license: string
  /** Страница файла на Викискладе. */
  source: string
}

export const RECIPE_PHOTOS: Record<string, RecipePhotoCredit> = {
  'choco-cottage-cream': {
    author: 'Lu from Seattle, USA',
    license: 'CC BY 2.0',
    source: 'https://commons.wikimedia.org/wiki/File:Chocolate_coffee_mousse.jpg',
  },
  'protein-pancakes': {
    author: 'Mae Mu',
    license: 'CC0',
    source:
      'https://commons.wikimedia.org/wiki/File:Foodiesfeed.com_pouring-honey-on-pancakes-with-walnuts.jpg',
  },
  syrniki: {
    author: 'Tatyana Morozyuk, color processing by Off-shell',
    license: 'CC BY-SA 3.0',
    source: 'https://commons.wikimedia.org/wiki/File:Syrniki6.jpg',
  },
  'veggie-omelette': {
    author: 'Bernt Rostad from Oslo, Norway',
    license: 'CC BY 2.0',
    source: 'https://commons.wikimedia.org/wiki/File:Taco_Omelette_(6424851671).jpg',
  },
  'oats-banana-pb': {
    author: 'Shisma',
    license: 'CC BY 4.0',
    source: 'https://commons.wikimedia.org/wiki/File:Banana_oatmeal_2.jpg',
  },
  'banana-smoothie': {
    author: 'Irma Sakul',
    license: 'CC BY-SA 4.0',
    source: 'https://commons.wikimedia.org/wiki/File:Mango_Banana_Smoothie.jpg',
  },
  'pb-cottage-cream': {
    author: 'Ella Olsson from Stockholm, Sweden',
    license: 'CC BY 2.0',
    source: 'https://commons.wikimedia.org/wiki/File:Peanut_butter_bowl_(43110725204).jpg',
  },
  'protein-shake': {
    author: 'Sandstein',
    license: 'CC BY 3.0',
    source: 'https://commons.wikimedia.org/wiki/File:Protein_shake.jpg',
  },
  'yogurt-berries': {
    author: 'Veganbaking.net from USA',
    license: 'CC BY-SA 2.0',
    source: 'https://commons.wikimedia.org/wiki/File:Vegan_yogurt,_March_2012.jpg',
  },
  'chicken-buckwheat': {
    author: 'Samurai2593',
    license: 'CC BY-SA 4.0',
    source:
      'https://commons.wikimedia.org/wiki/File:%D0%9A%D0%B0%D1%88%D0%B0_%D1%96%D0%B7_%D0%B7%D0%B5%D0%BB%D0%B5%D0%BD%D0%BE%D1%97_%D0%B3%D1%80%D0%B5%D1%87%D0%BA%D0%B8.jpg',
  },
  'salmon-rice': {
    author: 'Prayitno',
    license: 'CC BY 2.0',
    source: 'https://commons.wikimedia.org/wiki/File:Healthy_Entree_(8514368701).jpg',
  },
  'home-shawarma': {
    author: 'Vera Yu and David Li',
    license: 'CC BY 2.0',
    source: 'https://commons.wikimedia.org/wiki/File:Shawarma-sandwich-01.jpg',
  },
  'tuna-salad': {
    author: 'Daderot',
    license: 'CC0',
    source:
      'https://commons.wikimedia.org/wiki/File:Yellowfin_tuna_steak_with_walnut_sauce_and_hard-boiled_eggs,_on_mixed_greens_-_Massachusetts.jpg',
  },
  'turkey-pasta': {
    author: 'Silar',
    license: 'CC BY-SA 3.0',
    source:
      'https://commons.wikimedia.org/wiki/File:04668_Polish_spaghetti_pasta_with_sauce_made_of_pork_meat,_tomatoes,_garlic_and_olive.JPG',
  },
  'oat-flatbread': {
    author: '굿바이 조미료',
    license: 'CC BY 2.0 kr',
    source: 'https://commons.wikimedia.org/wiki/File:Aehobak-gyeran-mari_2.jpg',
  },
  'mug-cake': {
    author: 'Clever Cupcakes from Montreal, Canada',
    license: 'CC BY 2.0',
    source: 'https://commons.wikimedia.org/wiki/File:Cran-Raspberry_Cupcake_(4357512712).jpg',
  },
  'mw-casserole': {
    author: 'FDominec',
    license: 'CC BY-SA 4.0',
    source: 'https://commons.wikimedia.org/wiki/File:Recipes_cottage_cheese_pie_named_misa.jpg',
  },
  shakshuka: {
    author: 'Calliopejen1',
    license: 'CC BY-SA 3.0',
    source: 'https://commons.wikimedia.org/wiki/File:Shakshuka_by_Calliopejen1.jpg',
  },
  'overnight-oats': {
    author: 'Nervy8924',
    license: 'CC BY-SA 4.0',
    source: 'https://commons.wikimedia.org/wiki/File:Protein_overnight_oats.jpg',
  },
  'avocado-egg-toast': {
    author: 'Meg H',
    license: 'CC BY 2.0',
    source:
      'https://commons.wikimedia.org/wiki/File:Skinny-Fried-Egg-and-Avocado-Toast-Perfect-breakfast_(35555668870).jpg',
  },
  'millet-pumpkin': {
    author: 'Samurai2593',
    license: 'CC BY-SA 4.0',
    source:
      'https://commons.wikimedia.org/wiki/File:%D0%93%D0%B0%D1%80%D0%B1%D1%83%D0%B7%D0%BE%D0%B2%D0%BE-%D0%BF%D1%88%D0%BE%D0%BD%D1%8F%D0%BD%D0%B0_%D0%BA%D0%B0%D1%88%D0%B0.jpg',
  },
  'chicken-spinach-omelette': {
    author: 'Laura H-B',
    license: 'CC BY-SA 2.0',
    source: 'https://commons.wikimedia.org/wiki/File:346_-_Mon_Ami_Gabi.jpg',
  },
  'hummus-veggies': {
    author: 'Jennifer from Vancouver, Canada',
    license: 'CC BY 2.0',
    source: 'https://commons.wikimedia.org/wiki/File:Vegetables_and_Hummus_(7271118362).jpg',
  },
  'cottage-herb-crispbread': {
    author: 'Alicia Fagerving',
    license: 'CC BY-SA 3.0',
    source: 'https://commons.wikimedia.org/wiki/File:Falu_r%C3%A5g-rut.JPG',
  },
  'apple-peanut': {
    author: 'HaJunkiyada',
    license: 'CC BY-SA 4.0',
    source:
      'https://commons.wikimedia.org/wiki/File:Liat_Portal_for_Foodie_Disorder_-_Apple_slices_with_honey_for_Rosh_Hashanah.jpg',
  },
  'date-protein-balls': {
    author: 'Viktorija N. Ivanov',
    license: 'CC BY-SA 4.0',
    source:
      'https://commons.wikimedia.org/wiki/File:%D0%97%D0%B4%D1%80%D0%B0%D0%B2%D0%B8_%D1%87%D0%BE%D0%BA%D0%BE_%D1%82%D0%BE%D0%BF%D1%87%D0%B8%D1%9A%D0%B0.jpg',
  },
  'turkey-lavash-roll': {
    author: 'Takeaway',
    license: 'CC BY-SA 3.0',
    source: 'https://commons.wikimedia.org/wiki/File:Smoked_chicken_and_avocado_wrap.jpg',
  },
  'beef-bulgur': {
    author: 'E4024',
    license: 'CC BY-SA 4.0',
    source:
      'https://commons.wikimedia.org/wiki/File:Bulgur_pilav%C4%B1_(sehriyeli)_and_tas_kebap.jpg',
  },
  'cod-potato-beans': {
    author: 'Benreis',
    license: 'CC BY-SA 4.0',
    source: 'https://commons.wikimedia.org/wiki/File:Kuhler_Pannfisch.jpg',
  },
  'chicken-teriyaki': {
    author: 'CNEcija12345',
    license: 'CC BY-SA 4.0',
    source:
      'https://commons.wikimedia.org/wiki/File:Bowl_of_Teriyaki_chicken_and_beef_YakinikuCNE.jpg',
  },
  'turkey-meatballs': {
    author: 'Juan Emilio Prades Bel',
    license: 'CC BY 4.0',
    source: 'https://commons.wikimedia.org/wiki/File:Meatballs_with_tomato_sauce_(Spain).jpg',
  },
  'chickpea-chicken': {
    author: 'Kari Sullivan from Austin, TX',
    license: 'CC BY 2.0',
    source: 'https://commons.wikimedia.org/wiki/File:Spinach-Chickpea_Curry_(3117324894).jpg',
  },
  'shrimp-couscous': {
    author: 'Wajih Khalfallah',
    license: 'CC BY-SA 4.0',
    source: 'https://commons.wikimedia.org/wiki/File:Royal_Tunisian_couscous.JPG',
  },
  'salmon-bowl': {
    author: 'Andy Li',
    license: 'CC0',
    source:
      'https://commons.wikimedia.org/wiki/File:Salmon_Poke_Bowl_(S)_with_Spicy_mayo_sauce_-_Kitokito.jpg',
  },
  'chicken-noodle-soup': {
    author: 'Nichijyou123',
    license: 'CC BY-SA 4.0',
    source: 'https://commons.wikimedia.org/wiki/File:Chicken_Noodle_Soup_US.jpg',
  },
  'lentil-soup': {
    author: 'Andy Li',
    license: 'CC0',
    source: 'https://commons.wikimedia.org/wiki/File:Homemade_Lentil_Soup_-_Lavash_2025-02-10.jpg',
  },
  'pumpkin-cream-soup': {
    author: 'Cala cala_maffia',
    license: 'CC0',
    source: 'https://commons.wikimedia.org/wiki/File:Autumn_Soup_(Unsplash)_cropped.jpg',
  },
  'fish-soup': {
    author: 'Pannet',
    license: 'CC BY-SA 4.0',
    source:
      'https://commons.wikimedia.org/wiki/File:%D0%A3%D1%85%D0%B0_%D1%81_%D1%81%D0%B5%D0%BC%D0%B3%D0%BE%D0%B9.jpg',
  },
  'kefir-okroshka': {
    author: 'Nikkolo',
    license: 'CC BY-SA 3.0',
    source:
      'https://commons.wikimedia.org/wiki/File:%D0%9E%D0%BA%D1%80%D0%BE%D1%88%D0%BA%D0%B0_Okroshka_05.jpg',
  },
  'banana-honey-toast': {
    author: 'JasonParis',
    license: 'CC BY 2.0',
    source:
      'https://commons.wikimedia.org/wiki/File:New_Orleans,_LA_(French_Quarter)_Bananas_Foster_French_Toast.jpg',
  },
  'kefir-berries-oats': {
    author: 'Ann Larie Valentine',
    license: 'CC BY-SA 2.0',
    source: 'https://commons.wikimedia.org/wiki/File:Oatmeal,_blueberries_and_almond_milk.jpg',
  },
  'recovery-shake': {
    author: 'Steve Rainwater from Irving, US',
    license: 'CC BY-SA 2.0',
    source: 'https://commons.wikimedia.org/wiki/File:Chocolate_Milkshake_(52354323549).jpg',
  },
  'cottage-raisins': {
    author: 'Loyna',
    license: 'CC BY-SA 2.5',
    source: 'https://commons.wikimedia.org/wiki/File:%D0%A2%D0%B2%D0%BE%D1%80%D0%BE%D0%B3.jpg',
  },
  'salmon-crispbread': {
    author: 'Andy Li',
    license: 'CC0',
    source: 'https://commons.wikimedia.org/wiki/File:SMOKED_SALMON_TOAST_-_17_GRAMS_2025-09-20.jpg',
  },
  'banana-fritters': {
    author: 'Andy Li',
    license: 'CC0',
    source:
      'https://commons.wikimedia.org/wiki/File:Nutella_Banana_Pancakes_-_Laughing_Dog_2026-08-25.jpg',
  },
  'zucchini-fritters': {
    author: 'William Neuheisel from DC, US',
    license: 'CC BY 2.0',
    source:
      'https://commons.wikimedia.org/wiki/File:Zucchini_Fritters_-_Lunch_at_Yanyali_Fehmi_Lokantasi_(6421047753).jpg',
  },
  'lazy-khachapuri': {
    author: 'Vyacheslav Argenberg',
    license: 'CC BY 4.0',
    source: 'https://commons.wikimedia.org/wiki/File:Old_Tbilisi,_Georgian_khachapuri,_Georgia.jpg',
  },
  'protein-brownie-mug': {
    author: 'Phadke09',
    license: 'CC BY-SA 4.0',
    source: 'https://commons.wikimedia.org/wiki/File:Brownie_IMG_001.jpg',
  },
}

/** Адрес фото рецепта или null, если фото нет (свои блюда — рисунок DishArt). */
export function recipePhotoUrl(id: string): string | null {
  return RECIPE_PHOTOS[id] ? `${import.meta.env.BASE_URL}recipes/${id}.webp` : null
}
