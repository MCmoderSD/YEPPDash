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
                var level = status >= StatusCodes.Status500InternalServerError
                    ? LogLevel.Error
                    : LogLevel.Information;

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