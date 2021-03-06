import {Injectable} from "@angular/core";
import {Observable} from "rxjs/Observable";
import { ReplaySubject } from "rxjs/ReplaySubject";
import {CWLExecutorConfig} from "../../../electron/src/storage/types/cwl-executor-config";
import {ExecutorConfig} from "../../../electron/src/storage/types/executor-config";
import {RecentAppTab} from "../../../electron/src/storage/types/recent-app-tab";
import {AuthCredentials} from "../auth/model/auth-credentials";
import {TabData} from "../../../electron/src/storage/types/tab-data-interface";
import {IpcService} from "../services/ipc.service";
import {AppMeta, AppMetaEntry} from "../../../electron/src/storage/types/app-meta";
import {take, flatMap, map} from "rxjs/operators";
import {ProxySettings} from "../../../electron/src/storage/types/proxy-settings";

@Injectable()
export class LocalRepositoryService {

    private localFolders: ReplaySubject<string[]>                     = new ReplaySubject(1);
    private openTabs: ReplaySubject<TabData<any>[]>                   = new ReplaySubject(1);
    private expandedFolders: ReplaySubject<string[]>                  = new ReplaySubject(1);
    private recentApps: ReplaySubject<RecentAppTab[]>                 = new ReplaySubject(1);
    private credentials: ReplaySubject<AuthCredentials[]> = new ReplaySubject(1);
    private cwlExecutorConfig: ReplaySubject<CWLExecutorConfig>       = new ReplaySubject(1);
    private cwlExecutorConfigHistory: ReplaySubject<CWLExecutorConfig[]> = new ReplaySubject(1);
    private executorConfig: ReplaySubject<ExecutorConfig>             = new ReplaySubject(1);
    private activeCredentials: ReplaySubject<AuthCredentials>         = new ReplaySubject(1);
    private selectedAppsPanel: ReplaySubject<"myApps" | "publicApps"> = new ReplaySubject(1);
    private publicAppsGrouping: ReplaySubject<"toolkit" | "category"> = new ReplaySubject(1);
    private ignoredUpdateVersion: ReplaySubject<string>               = new ReplaySubject(1);
    private appMeta: ReplaySubject<AppMeta[]>                         = new ReplaySubject(1);
    private proxySettings: ReplaySubject<ProxySettings>               = new ReplaySubject(1);

    constructor(private ipc: IpcService) {

        this.listen("appMeta").subscribe(this.appMeta);
        this.listen("openTabs").subscribe(this.openTabs);
        this.listen("recentApps").subscribe(this.recentApps);
        this.listen("localFolders").subscribe(this.localFolders);
        this.listen("expandedNodes").subscribe(this.expandedFolders);
        this.listen("cwlExecutorConfig").subscribe(this.cwlExecutorConfig);
        this.listen("cwlExecutorConfigHistory").subscribe(this.cwlExecutorConfigHistory);
        this.listen("executorConfig").subscribe(this.executorConfig);
        this.listen("selectedAppsPanel").subscribe(this.selectedAppsPanel);
        this.listen("publicAppsGrouping").subscribe(this.publicAppsGrouping);
        this.listen("ignoredUpdateVersion").subscribe(this.ignoredUpdateVersion);
        this.listen("proxySettings").subscribe(this.proxySettings);

        this.listen("activeCredentials").pipe(
            map(cred => AuthCredentials.from(cred))
        ).subscribe(this.activeCredentials);

        this.listen("credentials").pipe(
            map(creds => creds.map(c => AuthCredentials.from(c)))
        ).subscribe(this.credentials);

    }

    getIgnoredUpdateVersion(): Observable<string> {
        return this.ignoredUpdateVersion;
    }

    setIgnoredUpdateVersion(ignoredUpdateVersion: string): Promise<any> {
        return this.patch({ignoredUpdateVersion}).toPromise();
    }

    getSelectedAppsPanel(): Observable<"myApps" | "publicApps"> {
        return this.selectedAppsPanel;
    }

    setSelectedAppsPanel(selectedAppsPanel: "myApps" | "publicApps"): Promise<any> {
        return this.patch({selectedAppsPanel}).toPromise();
    }

    getPublicAppsGrouping(): Observable<"toolkit" | "category"> {
        return this.publicAppsGrouping;
    }

    setPublicAppsGrouping(publicAppsGrouping: "toolkit" | "category" | "none"): Promise<any> {
        return this.patch({publicAppsGrouping}).toPromise();
    }

    getLocalFolders(): Observable<string[]> {
        return this.localFolders;
    }

    getOpenTabs(): Observable<TabData<any>[]> {
        return this.openTabs;
    }

    getRecentApps(): Observable<RecentAppTab[]> {
        return this.recentApps;
    }

    getExpandedFolders(): Observable<string[]> {
        return this.expandedFolders;
    }

    getCredentials(): Observable<AuthCredentials[]> {
        return this.credentials;
    }

    getActiveCredentials(): Observable<AuthCredentials> {
        return this.activeCredentials;
    }

    setActiveCredentials(activeCredentials: AuthCredentials = null): Promise<any> {
        return this.ipc.request("switchActiveUser", {credentials: activeCredentials}).toPromise();
    }

    setCredentials(credentials: AuthCredentials[]): Promise<any> {

        return this.activeCredentials.pipe(
            take(1),
            flatMap(activeCredentials => {
                const updateContainsActive = credentials.findIndex(c => c.equals(activeCredentials)) !== -1;

                const update = {credentials} as { credentials: AuthCredentials[], activeCredentials?: AuthCredentials };

                if (!updateContainsActive) {
                    update.activeCredentials = null;
                }

                return this.ipc.request("patchLocalRepository", update);
            })
        ).toPromise();
    }

    setFolderExpansion(foldersToExpand: string | string [], isExpanded: boolean): void {
        this.expandedFolders.pipe(
            take(1)
        ).subscribe(expandedFolders => {

            const patch  = new Set(expandedFolders);
            let modified = false;

            [].concat(foldersToExpand).forEach((item) => {
                const oldSize = patch.size;

                isExpanded ? patch.add(item) : patch.delete(item);

                if (oldSize !== patch.size) {
                    modified = true;
                }
            });

            if (modified) {
                this.patch({
                    expandedNodes: Array.from(patch)
                });
            }

        });
    }

    private listen(key: string) {
        return this.ipc.watch("watchLocalRepository", {key});
    }

    private patch(data: { [key: string]: any }): Observable<any> {
        return this.ipc.request("patchLocalRepository", data);
    }

    addLocalFolders(folders, expandFolders: boolean = false): Promise<any> {
        return this.getLocalFolders().pipe(
            take(1)
        ).toPromise().then(existingFolders => {
            const missing = folders.filter(folder => existingFolders.indexOf(folder) === -1);

            if (missing.length === 0) {
                return Promise.resolve();
            }

            if (expandFolders) {
                // Expand added folders
                this.setFolderExpansion(missing.concat("local"), true);
            }

            return this.patch({
                localFolders: existingFolders.concat(missing)
            }).toPromise();
        });
    }

    removeLocalFolders(...folders): Promise<any> {
        return this.getLocalFolders().pipe(
            take(1)
        ).toPromise().then(existing => {
            const update = existing.filter(path => folders.indexOf(path) === -1);

            if (update.length === existing.length) {
                return Promise.resolve();
            }

            return this.patch({
                localFolders: update
            }).toPromise();
        });
    }

    pushRecentApp(recentTabData: RecentAppTab, limit = 20): Promise<any> {

        return this.getRecentApps().pipe(
            take(1)
        ).toPromise().then((entries) => {
            const update = [recentTabData].concat(entries).filter((val, idx, arr) => {
                const duplicateIndex = arr.findIndex(el => el.id === val.id);
                return duplicateIndex === idx;
            }).slice(0, limit);

            return this.patch({recentApps: update}).toPromise();
        });
    }

    setOpenTabs(openTabs: TabData<any>[]): Promise<any> {
        return this.patch({openTabs}).toPromise();
    }

    getCWLExecutorConfig(): Observable<CWLExecutorConfig> {
        return this.cwlExecutorConfig;
    }

    setCWLExecutorConfig(cwlExecutorConfig: CWLExecutorConfig): Promise<any> {
        return this.patch({cwlExecutorConfig}).pipe(
            take(1)
        ).toPromise();
    }

    getCWLExecutorConfigHistory(): Observable<CWLExecutorConfig[]> {
        return this.cwlExecutorConfigHistory;
    }

    setCWLExecutorConfigHistory(cwlExecutorConfig: CWLExecutorConfig, limit = 5): Promise<any> {
        return this.getCWLExecutorConfigHistory().pipe(
            take(1)
        ).toPromise().then((entries) => {
            const update = [cwlExecutorConfig].concat(entries).filter((val, idx, arr) => {
                const duplicateIndex = arr.findIndex(el => {
                    return el.executorPath === val.executorPath &&
                           el.outDir.value === val.outDir.value &&
                           el.executorParams === val.executorParams;
                });
                return duplicateIndex === idx;
            }).slice(0, limit);

            return this.patch({cwlExecutorConfigHistory: update}).toPromise();
        });
    }

    getExecutorConfig(): Observable<ExecutorConfig> {
        return this.executorConfig;
    }

    setExecutorConfig(executorConfig: ExecutorConfig): Promise<any> {
        return this.patch({executorConfig}).pipe(
            take(1)
        ).toPromise();
    }

    getProxySettings(): Observable<ProxySettings> {
        return this.proxySettings;
    }

    setProxySettings(proxySettings: ProxySettings) {
        return this.patch({proxySettings}).pipe(
            take(1)
        ).toPromise();
    }

    getAppMeta<T extends keyof AppMetaEntry>(appID: string, key: T): Observable<AppMetaEntry[T]> {
        return this.appMeta.pipe(
            map(meta => {
                const data = meta[appID];

                if (key && data) {
                    return data[key];
                }
            })
        );
    }

    patchAppMeta(appID: string, key: keyof AppMetaEntry, value: any): Promise<any> {
        return this.ipc.request("patchAppMeta", {
            profile: "local",
            appID,
            key,
            value
        }).toPromise();
    }
}
