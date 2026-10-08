export interface Product {
  searchQuery?: string;
  exactName?: string;
  refreshError?: string | null;
  refreshStatus?: "ok" | "not_found" | "error";
  id: string;
  name: string;
  brand: string;
  unit: string;
  price: number | null;
  image?: string | null;
  storeId?: import("../shared/yandex").StoreId;
  fetchedAt?: string;
  sourceId?: string;
  externalUrl?: string;
  emoji: string;
  keywords: string[];
}
export interface Item {
  requirement?: import("../shared/recipe/purchasing").IngredientDemand;
  required?: boolean;
  allowReplacement?: boolean;
  productId: string;
  quantity: number;
  product?: Product;
}
export const products: Product[] = [
  {
    id: "beet",
    name: "Свёкла",
    brand: "",
    unit: "1 кг",
    price: null,
    emoji: "🫜",
    keywords: ["свек", "свёк"],
  },
  {
    id: "potato",
    name: "Картофель",
    brand: "",
    unit: "1 кг",
    price: null,
    emoji: "🥔",
    keywords: ["карто"],
  },
  {
    id: "carrot",
    name: "Морковь",
    brand: "",
    unit: "1 кг",
    price: null,
    emoji: "🥕",
    keywords: ["морков"],
  },
  {
    id: "cabbage",
    name: "Капуста белокочанная",
    brand: "",
    unit: "1 кг",
    price: null,
    emoji: "🥬",
    keywords: ["капуст"],
  },
  {
    id: "beef",
    name: "Говядина для супа",
    brand: "",
    unit: "500 г",
    price: null,
    emoji: "🥩",
    keywords: ["говяд", "мясо"],
  },
  {
    id: "onion",
    name: "Лук репчатый",
    brand: "",
    unit: "1 кг",
    price: null,
    emoji: "🧅",
    keywords: ["лук"],
  },
  {
    id: "paste",
    name: "Томатная паста",
    brand: "",
    unit: "140 г",
    price: null,
    emoji: "🥫",
    keywords: ["паста томат", "томатная"],
  },
  {
    id: "cream",
    name: "Сметана 20%",
    brand: "",
    unit: "350 г",
    price: null,
    emoji: "🥛",
    keywords: ["сметан"],
  },
  {
    id: "cream2",
    name: "Сметана 20%",
    brand: "",
    unit: "350 г",
    price: null,
    emoji: "🥛",
    keywords: [],
  },
  {
    id: "chicken",
    name: "Филе цыплёнка",
    brand: "",
    unit: "500 г",
    price: null,
    emoji: "🍗",
    keywords: ["куриц", "курин", "филе"],
  },
  {
    id: "pasta",
    name: "Спагетти",
    brand: "",
    unit: "500 г",
    price: null,
    emoji: "🍝",
    keywords: ["макарон", "спагет", "паста"],
  },
  {
    id: "pasta2",
    name: "Спагетти",
    brand: "",
    unit: "450 г",
    price: null,
    emoji: "🍝",
    keywords: [],
  },
  {
    id: "tomato",
    name: "Томаты черри",
    brand: "",
    unit: "250 г",
    price: null,
    emoji: "🍅",
    keywords: ["помид", "томат"],
  },
  {
    id: "cheese",
    name: "Сыр полутвёрдый",
    brand: "",
    unit: "200 г",
    price: null,
    emoji: "🧀",
    keywords: ["сыр"],
  },
  {
    id: "eggs",
    name: "Яйца",
    brand: "",
    unit: "10 шт",
    price: null,
    emoji: "🥚",
    keywords: ["яйц"],
  },
  {
    id: "milk",
    name: "Молоко 3,2%",
    brand: "",
    unit: "1 л",
    price: null,
    emoji: "🥛",
    keywords: ["молок"],
  },
  {
    id: "bread",
    name: "Хлеб зерновой",
    brand: "",
    unit: "400 г",
    price: null,
    emoji: "🍞",
    keywords: ["хлеб"],
  },
  {
    id: "avocado",
    name: "Авокадо",
    brand: "",
    unit: "1 шт",
    price: null,
    emoji: "🥑",
    keywords: ["авокад"],
  },
  {
    id: "oats",
    name: "Овсяные хлопья",
    brand: "",
    unit: "500 г",
    price: null,
    emoji: "🌾",
    keywords: ["овсян", "хлопь"],
  },
  {
    id: "banana",
    name: "Бананы",
    brand: "",
    unit: "1 кг",
    price: null,
    emoji: "🍌",
    keywords: ["банан"],
  },
];
export const recipes = [
  {
    id: "borscht",
    title: "Борщ, как дома",
    query: "Борщ на 5 человек",
    tag: "Классика на обед",
    time: "60 мин",
    people: 5,
    image:
      "https://images.unsplash.com/photo-1603105037880-880cd4edfb0d?auto=format&fit=crop&w=900&q=85",
    emoji: "🥣",
    color: "#e9dbe4",
    items: [
      "beet",
      "potato",
      "carrot",
      "cabbage",
      "beef",
      "onion",
      "paste",
      "cream",
    ],
  },
  {
    id: "pasta",
    title: "Паста с томатами",
    query: "Паста на 2 человек",
    tag: "Ужин без суеты",
    time: "20 мин",
    people: 2,
    image:
      "https://images.unsplash.com/photo-1473093226795-af9932fe5856?auto=format&fit=crop&w=900&q=85",
    emoji: "🍝",
    color: "#e9edcc",
    items: ["pasta", "tomato", "cheese"],
  },
  {
    id: "breakfast",
    title: "Доброе утро",
    query: "Завтрак на 2 человек",
    tag: "Начать день вкусно",
    time: "15 мин",
    people: 2,
    image:
      "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=900&q=85",
    emoji: "🥑",
    color: "#f6e4bc",
    items: ["eggs", "bread", "avocado", "milk"],
  },
];
