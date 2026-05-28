declare module "postman-collection-transformer" {
  const transformer: {
    convert: (
      input: Record<string, unknown>,
      options: { inputVersion: string; outputVersion: string; retainIds?: boolean },
      callback: (error: Error | null, converted: Record<string, unknown>) => void
    ) => void;
  };
  export default transformer;
}
