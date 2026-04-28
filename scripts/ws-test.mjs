import { io } from "socket.io-client";

const token = process.env.TOKEN;
const roomId = process.env.ROOM_ID;

const socket = io("http://localhost:3000/chat", { query: { token, roomId } });

socket.on("connect", () => console.log("connected", socket.id));
socket.on("room:joined", (p) => console.log("room:joined", p));
socket.on("room:user_joined", (p) => console.log("room:user_joined", p));
socket.on("message:new", (p) => console.log("message:new", p));
socket.on("room:user_left", (p) => console.log("room:user_left", p));
socket.on("room:deleted", (p) => console.log("room:deleted", p));
socket.on("error", (e) => console.log("error", e));
