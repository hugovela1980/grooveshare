import { createProjectMembersController } from "../src/page-controllers/project-members-controller.js";
import type { ProjectMember } from "../src/types.js";
import { tester } from "./test-runner/tester.js";

const owner: ProjectMember = {
  user: {
    id: "owner-1",
    email: "owner@example.com",
    displayName: "Owner",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  role: "owner",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function createFakeElements() {
  let submitHandler: ((event: { preventDefault?: () => void }) => void | Promise<void>) | null = null;
  let clickHandler: ((event: { target: EventTarget | null }) => void | Promise<void>) | null = null;
  let changeHandler: ((event: { target: EventTarget | null }) => void | Promise<void>) | null = null;

  return {
    form: {
      addEventListener(_eventName: "submit", handler: typeof submitHandler) {
        submitHandler = handler;
      },
    },
    emailInput: { value: "member@example.com" },
    roleSelect: { value: "viewer" },
    submitButton: {
      disabled: false,
      setAttribute() {},
      removeAttribute() {},
    },
    memberListElement: {
      innerHTML: "",
      addEventListener(
        eventName: "click" | "change",
        handler: typeof clickHandler,
      ) {
        if (eventName === "click") {
          clickHandler = handler;
        } else {
          changeHandler = handler;
        }
      },
    },
    statusElement: { textContent: "" as string | null },
    async submit() {
      await submitHandler?.({ preventDefault() {} });
    },
    async changeRole(userId: string, role: string) {
      await changeHandler?.({
        target: {
          value: role,
          dataset: {
            memberRoleSelect: "",
            userId,
          },
        } as unknown as EventTarget,
      });
    },
    async remove(userId: string) {
      await clickHandler?.({
        target: {
          closest(selector: string) {
            if (selector === "[data-member-remove-button]") {
              return {
                dataset: { userId },
              };
            }

            return null;
          },
        } as unknown as EventTarget,
      });
    },
  };
}

tester.describe("project members controller", () => {
  tester.it("loads, adds, updates, and removes members through Owner controls", async () => {
    const elements = createFakeElements();
    let listCount = 0;
    let addCount = 0;
    let updateCount = 0;
    let removeCount = 0;

    const controller = createProjectMembersController({
      projectId: "project-1",
      form: elements.form,
      emailInput: elements.emailInput,
      roleSelect: elements.roleSelect,
      submitButton: elements.submitButton,
      memberListElement: elements.memberListElement,
      statusElement: elements.statusElement,
      projectMembersApi: {
        async getProjectMembers() {
          listCount += 1;
          return [owner];
        },
        async addProjectMember(_projectId, input) {
          addCount += 1;
          return {
            ...owner,
            user: {
              ...owner.user,
              id: "member-1",
              email: input.email,
            },
            role: input.role,
          };
        },
        async updateProjectMemberRole(_projectId, _userId, role) {
          updateCount += 1;
          return {
            ...owner,
            user: {
              ...owner.user,
              id: "member-1",
            },
            role,
          };
        },
        async removeProjectMember() {
          removeCount += 1;
          return owner;
        },
      },
      renderMembers: (members) => `members:${members.length}`,
      confirmRemoveMember: () => true,
    });

    await controller.init();
    tester.expect(listCount).toBe(1);
    tester.expect(elements.memberListElement.innerHTML).toBe("members:1");

    await elements.submit();
    tester.expect(addCount).toBe(1);
    tester.expect(listCount).toBe(2);
    tester.expect(elements.emailInput.value).toBe("");

    await elements.changeRole("member-1", "contributor");
    tester.expect(updateCount).toBe(1);
    tester.expect(listCount).toBe(3);

    await elements.remove("member-1");
    tester.expect(removeCount).toBe(1);
    tester.expect(listCount).toBe(4);
  });
});
