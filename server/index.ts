import { Server } from "socket.io";

type TokenColor = "white" | "yellow" | "orange" | "red";

type Card = { suit: string; rank: number };
type Player = {
  id: string;
  name: string;
  hand: Card[];
  confirmed: boolean;
};

type Token = {
  color: TokenColor;
  star: number;
  owner?: string;
};

type Room = {
  code: string;
  players: Player[];
  deck: Card[];
  community: Card[];
  tokens: Token[];
  round: number;
};

const io = new Server(3000, { cors: { origin: "*" } });
const rooms = new Map<string, Room>();

function createDeck(): Card[] {
  const suits = ["H", "D", "C", "S"];
  const deck: Card[] = [];
  for (const s of suits)
    for (let r = 2; r <= 14; r++) deck.push({ suit: s, rank: r });
  return deck.sort(() => Math.random() - 0.5);
}

function roundColor(r: number): TokenColor {
  return ["white", "yellow", "orange", "red"][r - 1] as TokenColor;
}

io.on("connection", (socket) => {
  socket.on("create", (name) => {
    const code = Math.random().toString(36).substring(2, 8);
    const room: Room = {
      code,
      players: [{ id: socket.id, name, hand: [], confirmed: false }],
      deck: [],
      community: [],
      tokens: [],
      round: 1,
    };
    rooms.set(code, room);
    socket.join(code);
    io.to(code).emit("state", room);
  });

  socket.on("join", ({ code, name }) => {
    const room = rooms.get(code);
    if (!room) return;
    room.players.push({ id: socket.id, name, hand: [], confirmed: false });
    socket.join(code);
    io.to(code).emit("state", room);
  });

  socket.on("start", (code) => {
    const room = rooms.get(code)!;
    room.deck = createDeck();
    room.community = [];
    room.round = 1;
    room.tokens = [];

    room.players.forEach((p) => {
      p.hand = room.deck.splice(0, 2);
      p.confirmed = false;
    });

    ["white", "yellow", "orange", "red"].forEach((c) => {
      for (let i = 1; i <= 6; i++)
        room.tokens.push({ color: c as TokenColor, star: i });
    });

    io.to(code).emit("state", room);
  });

  socket.on("claim", ({ code, idx }) => {
    const room = rooms.get(code)!;
    const token = room.tokens[idx];
    if (token.color !== roundColor(room.round)) return;
    token.owner = socket.id;
    room.players.forEach((p) => (p.confirmed = false));
    io.to(code).emit("state", room);
  });

  socket.on("confirm", (code) => {
    const room = rooms.get(code)!;
    const p = room.players.find((x) => x.id === socket.id)!;
    p.confirmed = true;

    if (room.players.every((x) => x.confirmed)) {
      if (room.round === 2)
        room.community.push(...room.deck.splice(0, 3));
      if (room.round === 3 || room.round === 4)
        room.community.push(room.deck.splice(0, 1)[0]);

      room.round++;
      room.players.forEach((x) => (x.confirmed = false));
    }

    io.to(code).emit("state", room);
  });
});
// commit
