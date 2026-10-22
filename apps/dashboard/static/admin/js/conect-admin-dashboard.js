document.addEventListener("DOMContentLoaded", () => {
  const search = document.querySelector("#conect-admin-search");
  const count = document.querySelector("#conect-admin-directory-count");
  const emptyState = document.querySelector("#conect-admin-empty-results");
  const modules = Array.from(
    document.querySelectorAll("#content-main.app-list > .module"),
  );

  if (!search || !count || !emptyState || modules.length === 0) return;

  const normalize = (value) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt");

  const updateResults = () => {
    const query = normalize(search.value.trim());
    let visibleModules = 0;

    modules.forEach((module) => {
      const moduleName = normalize(
        module.querySelector("caption")?.textContent || "",
      );
      const moduleMatches = query.length === 0 || moduleName.includes(query);
      const rows = Array.from(module.querySelectorAll("tr[class*='model-']"));
      let visibleRows = 0;

      rows.forEach((row) => {
        const matches =
          moduleMatches || normalize(row.textContent || "").includes(query);
        row.hidden = !matches;
        if (matches) visibleRows += 1;
      });

      const isVisible = moduleMatches || visibleRows > 0;
      module.hidden = !isVisible;
      if (isVisible) visibleModules += 1;
    });

    count.textContent =
      visibleModules +
      " " +
      (visibleModules === 1 ? "\u00e1rea" : "\u00e1reas");
    emptyState.hidden = visibleModules !== 0;
  };

  search.addEventListener("input", updateResults);
});
