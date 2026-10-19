export function navigateTopLevel(href: string): void {
  const form = document.createElement("form");
  form.method = "GET";
  form.action = href;
  document.body.append(form);
  form.submit();
}
