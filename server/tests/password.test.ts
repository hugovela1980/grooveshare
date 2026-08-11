import {
    hashPassword,
    verifyPassword,
} from "../src/auth/password.js";
import { tester } from "./test-runner/tester.js";

tester.describe("password hashing", () => {
    tester.it(
        "hashes a password without storing the original password",
        async () => {
            const password = "MyStrongPassword123!";

            const passwordHash =
                await hashPassword(password);

            tester.expect(
                passwordHash === password,
            ).toBe(false);
        },
    );

    tester.it(
        "creates different hashes for the same password",
        async () => {
            const password = "MyStrongPassword123!";

            const firstHash =
                await hashPassword(password);

            const secondHash =
                await hashPassword(password);

            tester.expect(
                firstHash === secondHash,
            ).toBe(false);
        },
    );

    tester.it(
        "verifies the correct password",
        async () => {
            const password = "MyStrongPassword123!";

            const passwordHash =
                await hashPassword(password);

            const isValid = await verifyPassword(
                password,
                passwordHash,
            );

            tester.expect(isValid).toBe(true);
        },
    );

    tester.it(
        "rejects an incorrect password",
        async () => {
            const passwordHash =
                await hashPassword(
                    "MyStrongPassword123!",
                );

            const isValid = await verifyPassword(
                "WrongPassword!",
                passwordHash,
            );

            tester.expect(isValid).toBe(false);
        },
    );

    tester.it(
        "rejects an invalid stored password hash",
        async () => {
            const isValid = await verifyPassword(
                "MyStrongPassword123!",
                "not-a-valid-password-hash",
            );

            tester.expect(isValid).toBe(false);
        },
    );
});