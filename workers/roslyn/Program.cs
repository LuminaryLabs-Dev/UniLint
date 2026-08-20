using System.Text.Json;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;

record TargetEnvironment(string unityVersion, string unityLine, string platform, bool editor, string? backend, string? architecture, string? graphics, string[] defines);
record AssemblyPlan(string name, bool included, string[] sources, string[] references, string[] precompiledReferences, string[] defines, bool noEngineReferences, bool overrideReferences, bool allowUnsafeCode, string origin);
record ReferencePackPlan(string[] frameworkAssemblies, string[] engineAssemblies, string[] autoReferencedAssemblies);
record CompilePlan(string projectRoot, TargetEnvironment target, ReferencePackPlan referencePack, AssemblyPlan[] assemblies);
record AssemblyResult(string name, bool success, string[] diagnostics);

static class Program
{
    static int Main(string[] args)
    {
        string? planPath = Value(args, "--plan");
        string? referencePath = Value(args, "--references");
        if (planPath is null || referencePath is null)
        {
            Console.Error.WriteLine("--plan and --references are required");
            return 2;
        }
        var plan = JsonSerializer.Deserialize<CompilePlan>(File.ReadAllText(planPath), new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        if (plan is null) throw new InvalidOperationException("Invalid compile plan.");
        if (!Directory.Exists(referencePath)) throw new DirectoryNotFoundException(referencePath);

        var targetByName = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (string file in Directory.EnumerateFiles(referencePath, "*.dll", SearchOption.AllDirectories))
        {
            try
            {
                string? name = System.Reflection.AssemblyName.GetAssemblyName(file).Name;
                if (!string.IsNullOrWhiteSpace(name)) targetByName[name] = file;
            }
            catch { }
        }

        string temp = Path.Combine(Path.GetTempPath(), "unilint-roslyn-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(temp);
        var emitted = new Dictionary<string, string>(StringComparer.Ordinal);
        var pending = plan.assemblies.Where(a => a.included).ToList();
        var results = new List<AssemblyResult>();
        int guard = pending.Count + 4;

        while (pending.Count > 0 && guard-- > 0)
        {
            bool progress = false;
            foreach (var assembly in pending.ToArray())
            {
                var customDependencies = assembly.references.Where(r => plan.assemblies.Any(a => a.name == r && a.included)).ToArray();
                if (customDependencies.Any(dep => !emitted.ContainsKey(dep))) continue;
                var references = new List<MetadataReference>();
                var missingReferences = new List<string>();
                AddDeclaredReferences(plan.referencePack.frameworkAssemblies, targetByName, references, missingReferences, "framework");
                if (!assembly.noEngineReferences) AddDeclaredReferences(plan.referencePack.engineAssemblies, targetByName, references, missingReferences, "engine");
                references.AddRange(customDependencies.Select(dep => MetadataReference.CreateFromFile(emitted[dep])));
                foreach (string externalReference in assembly.references.Where(r => !customDependencies.Contains(r, StringComparer.Ordinal)))
                {
                    if (targetByName.TryGetValue(externalReference, out string? targetFile)) references.Add(MetadataReference.CreateFromFile(targetFile));
                    else missingReferences.Add(externalReference);
                }
                if (!assembly.overrideReferences) AddDeclaredReferences(plan.referencePack.autoReferencedAssemblies, targetByName, references, missingReferences, "auto-referenced");
                foreach (string precompiled in assembly.precompiledReferences)
                {
                    string? candidate = Directory.EnumerateFiles(plan.projectRoot, precompiled, SearchOption.AllDirectories).FirstOrDefault();
                    if (candidate is not null) references.Add(MetadataReference.CreateFromFile(candidate));
                    else missingReferences.Add(precompiled);
                }
                if (missingReferences.Count > 0)
                {
                    results.Add(new AssemblyResult(assembly.name, false, missingReferences.Select(value => $"UNILINT: missing assembly/precompiled reference '{value}'.").ToArray()));
                    pending.Remove(assembly);
                    progress = true;
                    continue;
                }

                var parseOptions = CSharpParseOptions.Default.WithLanguageVersion(LanguageVersion.CSharp9).WithPreprocessorSymbols(assembly.defines);
                var trees = assembly.sources.Select(source => CSharpSyntaxTree.ParseText(File.ReadAllText(Path.Combine(plan.projectRoot, source)), parseOptions, source)).ToArray();
                var options = new CSharpCompilationOptions(OutputKind.DynamicallyLinkedLibrary, allowUnsafe: assembly.allowUnsafeCode, deterministic: true);
                var compilation = CSharpCompilation.Create(assembly.name, trees, references, options);
                string output = Path.Combine(temp, SafeName(assembly.name) + ".dll");
                var emit = compilation.Emit(output);
                var errors = emit.Diagnostics.Where(d => d.Severity == DiagnosticSeverity.Error).Select(d => d.ToString()).ToArray();
                results.Add(new AssemblyResult(assembly.name, emit.Success, errors));
                if (emit.Success) emitted[assembly.name] = output;
                pending.Remove(assembly);
                progress = true;
            }
            if (!progress) break;
        }
        foreach (var assembly in pending) results.Add(new AssemblyResult(assembly.name, false, new[] { "UNILINT: unresolved custom assembly dependency cycle or missing reference." }));
        bool success = results.All(r => r.success);
        Console.WriteLine(JsonSerializer.Serialize(new { success, assemblies = results, diagnostics = results.SelectMany(r => r.diagnostics).ToArray() }, new JsonSerializerOptions { WriteIndented = true }));
        return success ? 0 : 1;
    }

    static void AddDeclaredReferences(IEnumerable<string> names, IReadOnlyDictionary<string, string> targetByName, List<MetadataReference> references, List<string> missing, string kind)
    {
        foreach (string name in names.Distinct(StringComparer.Ordinal))
        {
            if (targetByName.TryGetValue(name, out string? file)) references.Add(MetadataReference.CreateFromFile(file));
            else missing.Add($"{kind}:{name}");
        }
    }

    static string? Value(string[] args, string key)
    {
        int index = Array.IndexOf(args, key);
        return index >= 0 && index + 1 < args.Length ? args[index + 1] : null;
    }

    static string SafeName(string value) => string.Concat(value.Select(ch => Path.GetInvalidFileNameChars().Contains(ch) ? '_' : ch));
}
