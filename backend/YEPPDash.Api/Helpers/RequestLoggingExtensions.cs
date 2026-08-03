using System.Diagnostics;

namespace YEPPDash.Api.Helpers;

public static class RequestLoggingExtensions
{
    public const string Category = "YEPPDash.Api.Requests";

    public static WebApplication UseYeppDashRequestLogging(this WebApplication app)
    {
        var logger = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger(Category);

        app.Use(async (context, next) =>
        {
            if (context.Request.Path.StartsWithSegments("/health"))
            {
                await next(context);
                return;
            }

            var started = Stopwatch.GetTimestamp();

            try
            {
                await next(context);
            }
            finally
            {
                var status = context.Response.StatusCode;

                // A 404 that never reached an endpoint is somebody knocking — a proxy probing '/',
                // a scanner walking paths — not this API answering. Kept at Debug rather than
                // dropped, so raising the level still shows who is knocking. A 404 a controller
                // decided on is a real answer and stays at Information.
                var level = status switch
                {
                    >= StatusCodes.Status500InternalServerError => LogLevel.Error,
                    StatusCodes.Status404NotFound when context.GetEndpoint() is null => LogLevel.Debug,
                    _ => LogLevel.Information,
                };

                logger.Log(
                    level,
                    "{Method} {Path} -> {StatusCode} in {Elapsed:0.0}ms",
                    context.Request.Method,
                    context.Request.Path.Value,
                    status,
                    Stopwatch.GetElapsedTime(started).TotalMilliseconds);
            }
        });

        return app;
    }
}