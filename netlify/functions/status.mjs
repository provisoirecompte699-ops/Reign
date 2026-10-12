
export default async () => {
  return new Response(
    JSON.stringify({
      ok: true,
      message: "Les fonctions Reign fonctionnent."
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    }
  );
};
