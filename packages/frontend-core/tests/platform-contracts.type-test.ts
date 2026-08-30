import type {
  LoginInput,
  PlaybackEngine,
  RegisterUserInput,
  SessionProvider,
  StorageProvider,
  User,
} from "../src/index.js";

const user: User = {
  id: "user-1",
  email: "musician@example.com",
  displayName: "Musician",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const sessionProvider = {
  async registerUser(_input: RegisterUserInput) {
    return user;
  },
  async login(_input: LoginInput) {
    return user;
  },
  async logout() {},
  async getCurrentUser() {
    return user;
  },
} satisfies SessionProvider;

const storageProvider = {
  getItem(_key: string) {
    return null;
  },
  setItem(_key: string, _value: string) {},
  removeItem(_key: string) {},
} satisfies StorageProvider;

const playbackEngine = {
  loadMix() {},
  async play() {},
  pause() {},
  stop() {},
  seek() {},
  seekBy() {},
  seekToMusicalPosition() {},
  setLoopEnabled() {},
  setChannelVolume() {
    return true;
  },
  setChannelEnabled() {
    return true;
  },
  getSnapshot() {
    return {
      currentTime: 0,
      musicalPosition: { bar: 1, beat: 1 },
      duration: 0,
      isPlaying: false,
      hasLoadedChannels: false,
      preparation: {
        status: "idle",
        requiredChannelCount: 0,
        readyRequiredChannelCount: 0,
        channels: [],
        failure: null,
      },
    };
  },
  subscribe() {
    return () => {};
  },
} satisfies PlaybackEngine;

void sessionProvider;
void storageProvider;
void playbackEngine;
