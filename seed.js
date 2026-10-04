// Starter secrets so /random, /all and /filter return data on a fresh install.
const SECRETS = [
  "I still count on my fingers when nobody is looking.",
  "I told my boss I was stuck in traffic. I was still in bed.",
  "I waved back at someone who was waving at the person behind me.",
  "I have never finished a book I claimed to love.",
  "I practise arguments in the shower and still lose them.",
  "I pretend to understand wine.",
  "I once pushed a door marked pull for a full minute.",
  "I laugh at jokes I do not get so I am not left out.",
  "I google how to spell words I use every day.",
  "I ate my flatmate's leftovers and blamed the dog.",
  "I said 'you too' when the waiter told me to enjoy my meal.",
  "I keep a gym membership I have used twice.",
  "I talk to my plants and apologise when I forget to water them.",
  "I re-read my sent messages to check how I sounded.",
  "I have pretended to be on a phone call to avoid someone.",
  "I clapped when the plane landed. Alone.",
  "I copied my homework in school and still got it wrong.",
  "I tripped in public and jogged to make it look planned.",
  "I have a favourite spoon and get upset when it is in the wash.",
  "I say I am five minutes away when I have not left home.",
  "I cried at an advert for a bank.",
  "I do not know how to whistle and I am too old to ask.",
  "I still sleep with the hallway light on.",
  "I once replied-all to the whole company by accident.",
  "I named my car and I greet it every morning.",
  "I nod along in meetings and read the notes afterwards.",
  "I forgot my best friend's birthday three years in a row.",
  "I told everyone I ran a marathon. It was five kilometres.",
  "I hide snacks from my own family.",
  "I walked into a glass door at a job interview."
];

const USERS = ["user123", "nightowl", "quietfox", "bluekite", "papercup", "oldradio"];

module.exports = function seed() {
  const start = Date.parse("2022-10-01T12:00:00Z");
  return SECRETS.map((secret, i) => ({
    id: String(i + 1),
    secret,
    emScore: (i * 7) % 11, // spread of scores from 0 to 10
    username: USERS[i % USERS.length],
    timestamp: new Date(start + i * 36e5 * 26).toISOString()
  }));
};
