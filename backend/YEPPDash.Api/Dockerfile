# ---- Stage 1: Build ----
FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS build
WORKDIR /src

COPY YEPPDash.Api.csproj ./
RUN dotnet restore YEPPDash.Api.csproj

COPY . .
RUN dotnet publish YEPPDash.Api.csproj -c Release -o /app/publish --no-restore

# ---- Stage 2: Runtime ----
FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine AS runtime
WORKDIR /app

RUN addgroup -S dotnet && adduser -S dotnet -G dotnet

COPY --from=build --chown=dotnet:dotnet /app/publish .

USER dotnet

EXPOSE 8080

ENTRYPOINT ["dotnet", "YEPPDash.Api.dll"]
