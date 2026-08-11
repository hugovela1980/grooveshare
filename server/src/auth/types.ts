export type User = {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredUser = User & {
  passwordHash: string;
};

export type CreateUserInput = {
  email: string;
  displayName: string;
  passwordHash: string;
};