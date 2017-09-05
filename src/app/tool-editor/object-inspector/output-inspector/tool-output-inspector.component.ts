import {Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, ViewEncapsulation} from "@angular/core";
import {FormBuilder, FormControl, FormGroup} from "@angular/forms";
import {CommandInputParameterModel, CommandLineToolModel, CommandOutputParameterModel} from "cwlts/models";
import {DirectiveBase} from "../../../util/directive-base/directive-base";

@Component({
    encapsulation: ViewEncapsulation.None,

    selector: "ct-tool-output-inspector",
    template: `
        <form [formGroup]="form" (ngSubmit)="onSubmit()">

            <ct-basic-output-section [formControl]="form.controls['basicOutputSection']"
                                     [model]="model">
            </ct-basic-output-section>

            <ct-output-metadata-section [inputs]="inputList"
                                        *ngIf="form.controls['metaData']"
                                        [formControl]="form.controls['metaData']">
            </ct-output-metadata-section>

            <ct-output-eval [formControl]="form.controls['outputEval']"
                            [model]="model"
                            [readonly]="readonly">
            </ct-output-eval>

            <ct-secondary-file *ngIf="showSecondaryFiles()"
                               [context]="context"
                               [port]="output"
                               [bindingName]="'outputBinding'"
                               (update)="save.next(output)">
            </ct-secondary-file>

            <ct-description-section [formControl]="form.controls['description']">
            </ct-description-section>

        </form>
    `
})
export class ToolOutputInspectorComponent extends DirectiveBase implements OnChanges, OnInit {

    disabled = false;

    get readonly(): boolean {
        return this.disabled;
    }

    @Input("readonly")
    set readonly(value: boolean) {
        this.disabled = value;
        if (this.form) {
            if (this.disabled) {
                this.form.controls["basicOutputSection"].disable();
                this.form.controls["description"].disable();
                if (this.form.controls["metaData"]) {
                    this.form.controls["metaData"].disable();
                }
                if (this.showSecondaryFiles()) {
                    this.form.controls["outputBinding"].disable();
                }
            } else {
                this.form.controls["basicInputSection"].enable();
                this.form.controls["description"].enable();
                if (this.form.controls["metaData"]) {
                    this.form.controls["metaData"].enable();
                }
                if (this.showSecondaryFiles()) {
                    this.form.controls["outputBinding"].enable();
                }
            }
        }
    }

    @Input()
    public inputs: CommandInputParameterModel[] = [];

    @Input()
    public output: CommandOutputParameterModel;

    /** Context in which expression should be evaluated */
    @Input()
    public context: any = {};

    @Input()
    public model: CommandLineToolModel;

    public inputList: CommandInputParameterModel[] = [];

    public form: FormGroup;

    @Output()
    public save = new EventEmitter<CommandOutputParameterModel>();

    constructor(private formBuilder: FormBuilder) {
        super();
    }

    ngOnChanges(changes: SimpleChanges): void {
        const items = ["File", "record"];

        if (changes["inputs"]) {
            this.inputList = changes["inputs"].currentValue.filter(entry =>
                (items.indexOf(entry.type.type) > -1 ||
                (entry.type.type === "array" && items.indexOf(entry.type.items) > -1)));
        }
    }

    ngOnInit() {
        this.form = this.formBuilder.group({
            basicOutputSection: [{value: this.output, disabled: this.readonly}],
            description: [{value: this.output, disabled: this.readonly}],
            outputEval: [this.output]
        });

        if (this.output.outputBinding.hasMetadata && this.output.outputBinding.hasInheritMetadata) {
            this.form.addControl("metaData", new FormControl({value: this.output, disabled: this.readonly}));
        }

        this.tracked = this.form.valueChanges.subscribe(() => {
            this.save.next(this.output);
        });
    }

    showSecondaryFiles(): boolean {
        const isFile      = this.output.type.type === "File" || (this.output.type.type === "array" && this.output.type.items === "File");
        const hasSecFiles = this.output.hasSecondaryFilesInRoot || !!this.output.outputBinding;
        return isFile && hasSecFiles;
    }

    onSubmit() {
        this.save.next(this.output);
    }
}
